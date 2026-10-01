import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimit:
    """Sliding-window limiter, per client IP. In-memory: use Redis when running more than one instance."""

    def __init__(self, limit: int, window: int = 60):
        self.limit, self.window, self.hits = limit, window, defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = (request.client.host if request.client else "?", request.url.path if self.limit < 50 else "*")
        q, t = self.hits[key], time.monotonic()
        while q and q[0] < t - self.window:
            q.popleft()
        if len(q) >= self.limit:
            raise HTTPException(429, "Too many requests. Please slow down.")
        q.append(t)
