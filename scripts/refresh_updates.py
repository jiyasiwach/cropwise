"""Save the official announcements feed with the code, dated, as the fallback when it cannot be reached.

Some government sites refuse requests from cloud servers, so the app ships the last copy fetched
from an ordinary connection and says how old it is. Run before deploying:

    python scripts/refresh_updates.py
"""

import asyncio
import datetime
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from cropwise.services import schemes  # noqa: E402


async def main() -> None:
    schemes.DATA.joinpath("updates_snapshot.json").unlink(missing_ok=True)  # never save a stale copy as new
    result = await schemes.updates(30)
    if result["error"] or not result["items"]:
        sys.exit(f"Feed not reachable: {result['error']}")
    out = {"fetched_on": datetime.date.today().isoformat(), "source": result["source"],
           "feed_url": result["feed_url"], "items": result["items"]}
    schemes.DATA.joinpath("updates_snapshot.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"saved {len(out['items'])} announcements as of {out['fetched_on']}")


if __name__ == "__main__":
    asyncio.run(main())
