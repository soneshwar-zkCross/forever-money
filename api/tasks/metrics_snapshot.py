"""
Metrics Snapshot Background Task

Periodically stores metrics snapshots for historical tracking and charts.
Runs in the API process without modifying validator code.

Architecture:
  - READS from: reader DB (validator tables: Job, MinerScore, Round, etc.)
  - WRITES to: local metrics DB (SQLite, api/data/metrics.db)
"""
import asyncio
import logging
from datetime import datetime

from tortoise.exceptions import IntegrityError

from validator.models.job import Job, MinerScore, Round, RoundStatus
from validator.repositories.job import JobRepository
from validator.repositories.pool import PoolDataDB
from api.services.metrics_calculator import MetricsCalculator, _resolve_pool_tokens
from api.services.identity_service import IdentityService
from api.models.metrics import JobMetrics, MinerMetrics, SubnetMetricsSnapshot, VaultBalanceSnapshot

logger = logging.getLogger(__name__)


async def snapshot_all_metrics(interval_seconds: int = 300):
    """
    Store metrics snapshots for all active jobs.

    Runs continuously in the background, storing:
    - Job metrics (TVL, revenue, APY)
    - Initial vault balances (for inventory change tracking)
    - Subnet-wide aggregates
    - Miner metrics (earnings, scores, win rates)

    Args:
        interval_seconds: Seconds between snapshots (default: 300 = 5 minutes)
    """
    logger.info(f"Starting metrics snapshot task (interval: {interval_seconds}s)")

    while True:
        try:
            await _snapshot_iteration()
        except Exception as e:
            logger.error(f"Error in metrics snapshot iteration: {e}", exc_info=True)

        await asyncio.sleep(interval_seconds)


async def _snapshot_iteration():
    """Single snapshot iteration"""
    start_time = datetime.utcnow()

    # Get active jobs (reads from reader DB)
    job_repo = JobRepository()
    pool_db = PoolDataDB()
    active_jobs = await job_repo.get_active_jobs()

    if not active_jobs:
        logger.debug("No active jobs to snapshot")
        return

    logger.info(f"Snapshotting metrics for {len(active_jobs)} active jobs")

    # Track subnet-wide aggregates
    total_tvl_usd = 0.0
    total_revenue_usd = 0.0

    # Snapshot each job (writes to local metrics DB)
    for job in active_jobs:
        try:
            # Check for initial snapshot (for inventory change tracking)
            await _ensure_initial_snapshot(job)

            # Calculate and store current metrics
            job_metrics = await MetricsCalculator.calculate_and_store_job_metrics(
                job, pool_db
            )

            # Aggregate for subnet snapshot
            total_tvl_usd += job_metrics.tvl_usd or 0.0
            total_revenue_usd += job_metrics.revenue_usd or 0.0

            logger.debug(
                f"Stored metrics for {job.job_id}: "
                f"TVL=${job_metrics.tvl_usd:.2f}, "
                f"Revenue=${job_metrics.revenue_usd:.2f}"
            )

        except Exception as e:
            logger.error(f"Failed to snapshot job {job.job_id}: {e}")
            continue

    # Store subnet-wide snapshot
    try:
        await _store_subnet_snapshot(
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            vault_count=len(active_jobs)
        )
    except Exception as e:
        logger.error(f"Failed to store subnet snapshot: {e}")

    # Snapshot miner metrics
    try:
        await _snapshot_miner_metrics()
    except Exception as e:
        logger.error(f"Failed to snapshot miner metrics: {e}")

    duration = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        f"Snapshot complete: {len(active_jobs)} jobs, "
        f"total TVL=${total_tvl_usd:.2f}, took {duration:.2f}s"
    )


async def _ensure_initial_snapshot(job: Job):
    """
    Ensure an initial balance snapshot exists for inventory change tracking.

    Creates a snapshot the first time we see a job.
    """
    # Check if initial snapshot already exists
    initial = await VaultBalanceSnapshot.filter(
        job_id=job.job_id,
        snapshot_type="initial"
    ).first()

    if initial:
        return  # Already have initial snapshot

    # First time seeing this job - create initial snapshot
    try:
        tvl = await MetricsCalculator.calculate_job_tvl(job)

        await VaultBalanceSnapshot.create(
            job_id=job.job_id,
            timestamp=datetime.utcnow(),
            balance_token0=tvl["tvl_token0"],
            balance_token1=tvl["tvl_token1"],
            balance_usd=tvl["tvl_usd"],
            snapshot_type="initial",
            metadata={
                "vault_address": job.sn_liquidity_manager_address,
                "pair_address": job.pair_address,
                "token0_price": tvl["token0_price_usd"],
                "token1_price": tvl["token1_price_usd"],
            }
        )

        logger.info(f"Created initial snapshot for job {job.job_id}: TVL=${tvl['tvl_usd']:.2f}")

    except IntegrityError:
        # Race condition - another process created it
        logger.debug(f"Initial snapshot already exists for {job.job_id}")
    except Exception as e:
        logger.error(f"Failed to create initial snapshot for {job.job_id}: {e}")


async def _store_subnet_snapshot(
    total_tvl_usd: float,
    total_revenue_usd: float,
    vault_count: int
):
    """Store subnet-wide metrics snapshot"""
    try:
        # Get emissions data from BittensorClient
        from api.utils.bittensor_client import BittensorClient

        total_emissions_alpha = 0.0
        try:
            metagraph = BittensorClient.get_metagraph()
            if metagraph and hasattr(metagraph, 'emission'):
                total_emission_rao = sum(metagraph.emission)
                total_emissions_alpha = float(total_emission_rao) / 1e9
        except Exception as e:
            logger.warning(f"Could not read metagraph emissions: {e}")

        await SubnetMetricsSnapshot.create(
            snapshot_time=datetime.utcnow(),
            total_tvl_usd=total_tvl_usd,
            total_revenue_usd=total_revenue_usd,
            total_emissions_alpha=total_emissions_alpha,
            total_emissions_usd=0.0,  # TODO: Calculate from alpha price
            burn_ratio=0.0,  # TODO: Get from EmissionsService
            miner_ratio=0.0,  # TODO: Get from EmissionsService
            profit_ratio=0.0,  # TODO: Calculate
            metadata={
                "vault_count": vault_count,
                "snapshot_source": "api_background_task"
            }
        )

        logger.debug(f"Stored subnet snapshot: TVL=${total_tvl_usd:.2f}")

    except Exception as e:
        logger.error(f"Failed to store subnet snapshot: {e}")


async def _snapshot_miner_metrics():
    """Snapshot metrics for all active miners (reads reader DB, writes local DB).

    Aggregates stats across ALL jobs for each miner so the list page shows
    correct totals. Scores use max (best job), counts use sum (all jobs).

    Stores all fields the miners list page needs so the endpoint can serve
    from SQLite cache instead of hitting the remote PostgreSQL on every request.
    Historical rows are kept for /{uid}/metrics-history.
    """
    all_scores = await MinerScore.all().prefetch_related("job")

    # Aggregate across all jobs per miner_uid
    aggregated: dict[int, dict] = {}
    for score in all_scores:
        uid = score.miner_uid
        if uid not in aggregated:
            aggregated[uid] = {
                "miner_hotkey": score.miner_hotkey,
                "combined_score": 0.0,
                "evaluation_score": 0.0,
                "live_score": 0.0,
                "total_evaluations": 0,
                "total_live_rounds": 0,
                "participation_days": 0,
                "is_eligible_for_live": False,
            }

        agg = aggregated[uid]
        # Scores: max across jobs
        agg["combined_score"] = max(agg["combined_score"], float(score.combined_score))
        agg["evaluation_score"] = max(agg["evaluation_score"], float(score.evaluation_score))
        agg["live_score"] = max(agg["live_score"], float(score.live_score))
        # Counts: sum across all jobs
        agg["total_evaluations"] += score.total_evaluations
        agg["total_live_rounds"] += score.total_live_rounds
        agg["participation_days"] += score.participation_days
        # Eligible if eligible in any job
        if score.is_eligible_for_live:
            agg["is_eligible_for_live"] = True

    # Resolve on-chain identities once for the whole batch
    identities = await IdentityService.get_all_identities()

    snapshot_time = datetime.utcnow()

    logger.info(f"Snapshotting metrics for {len(aggregated)} miners")

    for miner_uid, agg in aggregated.items():
        try:
            total_evals = agg["total_evaluations"]
            total_live = agg["total_live_rounds"]
            total_participations = total_evals + total_live

            estimated_earnings_alpha = 0.0
            estimated_earnings_usd = 0.0
            try:
                from api.services.miner_earnings_service import MinerEarningsService
                earnings = await MinerEarningsService.calculate_miner_earnings(miner_uid)
                estimated_earnings_alpha = earnings.get("estimated_earnings_alpha", 0.0)
                estimated_earnings_usd = earnings.get("estimated_earnings_usd", 0.0)
            except Exception:
                pass

            await MinerMetrics.create(
                miner_uid=miner_uid,
                miner_hotkey=agg["miner_hotkey"],
                miner_name=IdentityService.get_name_for_uid(miner_uid, identities),
                snapshot_time=snapshot_time,
                # Scores (max across jobs)
                combined_score=agg["combined_score"],
                evaluation_score=agg["evaluation_score"],
                live_score=agg["live_score"],
                total_score=agg["combined_score"],
                # Participation (summed across all jobs)
                participation_days=agg["participation_days"],
                total_evaluations=total_evals,
                total_live_rounds=total_live,
                is_eligible_for_live=agg["is_eligible_for_live"],
                # Earnings
                estimated_earnings_alpha=estimated_earnings_alpha,
                estimated_earnings_usd=estimated_earnings_usd,
                # Legacy
                win_rate=0.0,
                total_wins=0,
                total_participations=total_participations,
            )

            logger.debug(
                f"Stored miner metrics for UID {miner_uid}: "
                f"combined={agg['combined_score']:.4f} "
                f"evals={total_evals} live={total_live}"
            )

        except Exception as e:
            logger.error(f"Failed to snapshot miner {miner_uid}: {e}")
            continue


async def prewarm_price_cache():
    """
    Pre-warm the SQLite price cache on startup.

    Fetches TAO price + token prices for all active jobs so the very first
    dashboard load serves cached prices instead of hitting CoinGecko.

    Throttles requests (2s between each) to stay under CoinGecko's free-tier
    rate limit and avoid colliding with the concurrent snapshot task.
    """
    from validator.services.price import PriceService

    # Small initial delay so the snapshot task gets a head start and we
    # don't fire two CoinGecko bursts simultaneously on boot.
    await asyncio.sleep(5)

    logger.info("Pre-warming price cache...")

    # 1. TAO price
    try:
        tao = await PriceService.get_tao_price_usd()
        logger.info(f"  TAO price cached: ${tao}")
    except Exception as e:
        logger.warning(f"  Failed to pre-warm TAO price: {e}")

    await asyncio.sleep(2)

    # 2. Token prices for every active job
    try:
        job_repo = JobRepository()
        active_jobs = await job_repo.get_active_jobs()

        seen_tokens: set[str] = set()
        for job in active_jobs:
            try:
                tokens = await _resolve_pool_tokens(job.chain_id, job.pair_address)
                if not tokens:
                    continue
                token0, token1 = tokens
                for token_addr in (token0, token1):
                    key = f"{token_addr.lower()}:{job.chain_id}"
                    if key in seen_tokens:
                        continue
                    seen_tokens.add(key)
                    try:
                        price = await PriceService.get_token_price(token_addr, job.chain_id)
                        logger.info(f"  Token {token_addr[:10]}... cached: ${price:.4f}")
                    except Exception as e:
                        logger.warning(f"  Failed to cache token {token_addr[:10]}...: {e}")
                    # Throttle: 2s between CoinGecko calls to avoid 429s
                    await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"  Failed to resolve tokens for job {job.job_id}: {e}")

        logger.info(f"Price cache pre-warm complete ({len(seen_tokens)} tokens)")
    except Exception as e:
        logger.error(f"Failed to pre-warm token prices: {e}")
