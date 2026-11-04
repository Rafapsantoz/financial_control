import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from httpx import ASGITransport, AsyncClient
from app.main import app
from app.db.init_db import init_db


async def empirical_live_check():
    # Initialize DB (native financial.db)
    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        print("=== 1. Checking Seed Data ===")
        r_owners = await client.get("/api/v1/owners")
        assert r_owners.status_code == 200
        owners = r_owners.json()
        print("Owners:", [o["name"] for o in owners])
        assert any(o["name"] == "Rafael" for o in owners)
        assert any(o["name"] == "Mãe" for o in owners)
        assert any(o["name"] == "Irmã" for o in owners)

        print("\n=== 2. Testing Duplicate Owner Creation Casing & Whitespace ===")
        for bad_name in ["Rafael", "rafael ", "RAFAEL", "  rafael  "]:
            r = await client.post("/api/v1/owners", json={"name": bad_name})
            print(f"Attempt {bad_name!r} -> HTTP {r.status_code}: {r.json().get('detail')}")
            assert r.status_code == 409, f"Expected 409, got {r.status_code}"

        print("\n=== 3. Testing Invalid Installments Validation ===")
        r_parcs = await client.post(
            "/api/v1/transactions",
            json={"description": "Bad Parcs", "value": 50.0, "cur_parcs": 5, "total_parcs": 3},
        )
        print(f"cur=5, total=3 -> HTTP {r_parcs.status_code}: {r_parcs.json().get('detail')}")
        assert r_parcs.status_code == 422

        print("\n=== 4. Testing Negative/Zero Value Validation ===")
        for v in [0.0, -15.5]:
            r_val = await client.post("/api/v1/transactions", json={"description": "Bad Val", "value": v})
            print(f"value={v} -> HTTP {r_val.status_code}")
            assert r_val.status_code == 422

        print("\n=== 5. Testing Non-existent Foreign Keys ===")
        r_fk = await client.post(
            "/api/v1/transactions",
            json={"description": "Bad FK", "value": 20.0, "owner_id": 9999},
        )
        print(f"owner_id=9999 -> HTTP {r_fk.status_code}: {r_fk.json().get('detail')}")
        assert r_fk.status_code == 400

        print("\n=== 6. Testing Cascade Deletion Protection ===")
        # Create dedicated test owner
        r_new_owner = await client.post("/api/v1/owners", json={"name": "Empirical Test Owner"})
        assert r_new_owner.status_code == 201
        test_oid = r_new_owner.json()["id"]
        # Link transaction
        r_tx = await client.post(
            "/api/v1/transactions",
            json={"description": "Empirical Link", "value": 33.0, "owner_id": test_oid},
        )
        assert r_tx.status_code == 201
        test_txid = r_tx.json()["id"]
        # Try delete owner -> expect 409
        r_del_fail = await client.delete(f"/api/v1/owners/{test_oid}")
        print(f"Delete owner with linked tx -> HTTP {r_del_fail.status_code}: {r_del_fail.json().get('detail')}")
        assert r_del_fail.status_code == 409
        # Delete transaction
        r_del_tx = await client.delete(f"/api/v1/transactions/{test_txid}")
        assert r_del_tx.status_code == 200
        # Delete owner -> expect 200
        r_del_ok = await client.delete(f"/api/v1/owners/{test_oid}")
        print(f"Delete owner after tx deleted -> HTTP {r_del_ok.status_code}: {r_del_ok.json().get('detail')}")
        assert r_del_ok.status_code == 200

        print("\n=== 7. Testing Toggle-paid Endpoint State & Persistence ===")
        r_tx_toggle = await client.post(
            "/api/v1/transactions",
            json={"description": "Toggle Empirical", "value": 99.0, "is_paid": False},
        )
        assert r_tx_toggle.status_code == 201
        toggle_id = r_tx_toggle.json()["id"]
        assert r_tx_toggle.json()["is_paid"] is False

        t1 = await client.patch(f"/api/v1/transactions/{toggle_id}/toggle-paid")
        assert t1.status_code == 200
        assert t1.json()["is_paid"] is True
        print(f"Toggle 1 -> is_paid: {t1.json()['is_paid']}")

        t2 = await client.patch(f"/api/v1/transactions/{toggle_id}/toggle-paid")
        assert t2.status_code == 200
        assert t2.json()["is_paid"] is False
        print(f"Toggle 2 -> is_paid: {t2.json()['is_paid']}")

        # Confirm database persistence by fetching transaction again
        t_verify = await client.get(f"/api/v1/transactions/{toggle_id}")
        assert t_verify.status_code == 200
        assert t_verify.json()["is_paid"] is False
        print(f"Verified DB persistence via GET: is_paid is {t_verify.json()['is_paid']}")

        # Clean up
        await client.delete(f"/api/v1/transactions/{toggle_id}")

    print("\nALL EMPIRICAL CHECKS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(empirical_live_check())
