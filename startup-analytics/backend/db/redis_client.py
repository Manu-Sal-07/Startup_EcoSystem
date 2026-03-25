import os
import json
import time
from uuid import uuid4
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


def blacklist_token(jti, ttl):
    r.setex(f"blacklist:token:{jti}", ttl, "1")


def is_blacklisted(jti):
    return bool(r.exists(f"blacklist:token:{jti}"))


def achievement_cache_key(startup_id):
    return f"achievements:{startup_id}"


def acquire_fund_lock(startup_id, ttl=10):
    lock_key = f"fund_lock:startup:{startup_id}"
    lock_token = str(uuid4())
    for _ in range(3):
        acquired = r.set(lock_key, lock_token, nx=True, ex=ttl)
        if acquired:
            return lock_token
        time.sleep(0.35)
    return None


def release_fund_lock(startup_id, lock_token):
    lock_key = f"fund_lock:startup:{startup_id}"
    stored = r.get(lock_key)
    if stored and stored == lock_token:
        r.delete(lock_key)
        return True
    return False


def view_log(startup_id, investor_id, ts=None):
    key = f"views:startup:{startup_id}"
    if ts is None:
        import time

        ts = int(time.time())
    r.hset(key, investor_id, ts)


def view_get(startup_id):
    key = f"views:startup:{startup_id}"
    return r.hgetall(key)
