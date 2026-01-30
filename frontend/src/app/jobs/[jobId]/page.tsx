'use client'

import { useQuery } from '@tanstack/react-query'
import { getJob, getLeaderboard, getRounds, getCurrentRound } from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, Clock, Trophy, Zap } from 'lucide-react'
import { formatNumber, formatRelativeTime } from '@/lib/utils'
import { use } from 'react'

export default function JobDashboard({
    params,
}: {
    params: Promise<{ jobId: string }>
}) {
    const { jobId } = use(params)

    const { data: job, isLoading: jobLoading } = useQuery({
        queryKey: ['job', jobId],
        queryFn: () => getJob(jobId),
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    const { data: leaderboard } = useQuery({
        queryKey: ['leaderboard', jobId],
        queryFn: () => getLeaderboard(jobId, { limit: 10 }),
        refetchInterval: 30000,
    })

    const { data: roundsData } = useQuery({
        queryKey: ['rounds', jobId],
        queryFn: () => getRounds(jobId, { limit: 10 }),
        refetchInterval: 30000,
    })

    const { data: currentRound } = useQuery({
        queryKey: ['currentRound', jobId],
        queryFn: () => getCurrentRound(jobId),
        refetchInterval: 10000, // More frequent for active round
    })

    if (jobLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    if (!job) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Job Not Found</h2>
                    <p className="text-muted-foreground mb-4">The requested job does not exist</p>
                    <Link href="/" className="text-primary hover:underline">
                        ← Back to home
                    </Link>
                </div>
            </div>
        )
    }

    const stats = job.stats

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border glass sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold">{job.metadata?.pair_name || job.job_id}</h1>
                            <p className="text-sm text-muted-foreground">{job.metadata?.description}</p>
                        </div>
                        {currentRound && (
                            <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs text-blue-400">Round {currentRound.round_number}</p>
                                <p className="text-sm font-semibold text-blue-500">
                                    {Math.floor(currentRound.time_remaining_seconds / 60)}m {currentRound.time_remaining_seconds % 60}s
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="stat-card card-gradient">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-green-500/10">
                                <Users className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Miners</p>
                                <p className="text-2xl font-bold">{stats?.total_miners || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card card-gradient">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-blue-500/10">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Rounds</p>
                                <p className="text-2xl font-bold">{stats?.total_rounds || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card card-gradient">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-purple-500/10">
                                <Clock className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Active 24h</p>
                                <p className="text-2xl font-bold">{stats?.active_miners_24h || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card card-gradient">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-orange-500/10">
                                <Zap className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Participation</p>
                                <p className="text-2xl font-bold">
                                    {formatNumber((stats?.avg_participation_rate || 0) * 100, 0)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Leaderboard */}
                    <div className="stat-card card-gradient">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                <h2 className="text-lg font-semibold">Top Miners</h2>
                            </div>
                            <Link
                                href={`/jobs/${jobId}/leaderboard`}
                                className="text-sm text-primary hover:underline"
                            >
                                View All
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {leaderboard?.leaderboard.slice(0, 10).map((miner) => (
                                <div
                                    key={miner.miner_uid}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                            {miner.rank}
                                        </div>
                                        <div>
                                            <p className="text-sm font-mono">
                                                {miner.miner_hotkey.slice(0, 8)}...{miner.miner_hotkey.slice(-6)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">UID: {miner.miner_uid}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold">{formatNumber(miner.combined_score)}</p>
                                        <p className="text-xs text-green-500">{formatNumber(miner.win_rate * 100, 1)}% WR</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Rounds */}
                    <div className="stat-card card-gradient">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <h2 className="text-lg font-semibold">Recent Rounds</h2>
                            </div>
                            <Link
                                href={`/jobs/${jobId}/rounds`}
                                className="text-sm text-primary hover:underline"
                            >
                                View All
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {roundsData?.rounds.slice(0, 10).map((round) => (
                                <div
                                    key={round.round_id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold">Round #{round.round_number}</span>
                                            <span
                                                className={`px-2 py-0.5 text-xs rounded-full ${round.round_type === 'live'
                                                        ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                                        : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                    }`}
                                            >
                                                {round.round_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {round.participants} participants
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">
                                            {formatRelativeTime(new Date(round.start_time))}
                                        </p>
                                        {round.winner_uid && (
                                            <p className="text-xs text-green-500">Winner: UID {round.winner_uid}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
