"""
Executions Service

Business logic for live execution operations.
"""
from typing import List, Optional, Dict, Any, Tuple
from tortoise.expressions import Q

from validator.models.job import Job, LiveExecution


class ExecutionsService:
    """Service for live execution operations"""

    @staticmethod
    async def get_executions(
        job: Job,
        limit: int = 50,
        offset: int = 0,
        tx_status: Optional[str] = None
    ) -> Tuple[List[LiveExecution], int]:
        """
        Get live executions for a job
        
        Returns: (executions_list, total_count)
        """
        query = LiveExecution.filter(job=job)
        
        if tx_status:
            query = query.filter(tx_status=tx_status)
        
        # Get total count
        total_count = await query.count()
        
        # Get paginated results
        executions = await query.order_by("-executed_at").offset(offset).limit(limit).prefetch_related('round')
        
        return executions, total_count

    @staticmethod
    async def get_execution_by_id(execution_id: str) -> Optional[LiveExecution]:
        """Get execution by ID"""
        return await LiveExecution.filter(execution_id=execution_id).prefetch_related('round').first()
