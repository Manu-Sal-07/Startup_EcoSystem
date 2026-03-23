import os
import json
try:
    import redis
except ImportError:  # pragma: no cover - exercised in dependency-light test envs
    redis = None

REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))



class _UnavailableRedis:
    def __getattr__(self, name):
        raise RuntimeError("redis package is not installed")


r = (
    redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    if redis is not None
    else _UnavailableRedis()
)


def cache_get(key):
    val = r.get(key)
    if not val:
        return None
    try:
        return json.loads(val)
    except Exception:
        return val


def cache_set(key, value, ttl=300):
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    r.setex(key, ttl, value)


def cache_delete(*keys):
    if not keys:
        return
    r.delete(*keys)


def cache_delete_pattern(pattern):
    keys = r.keys(pattern)
    if keys:
        r.delete(*keys)


def view_log(startup_id, investor_id, ts=None):
    key = f"views:startup:{startup_id}"
    if ts is None:
        import time

        ts = int(time.time())
    r.hset(key, investor_id, ts)


def view_get(startup_id):
    key = f"views:startup:{startup_id}"
    return r.hgetall(key)
