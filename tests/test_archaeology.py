from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "validate_archaeology", ROOT / "scripts" / "validate_archaeology.py"
)
assert SPEC and SPEC.loader
validate_archaeology = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validate_archaeology)


class ArchaeologyBaselineTests(unittest.TestCase):
    def test_partial_baseline_has_expected_shape(self) -> None:
        nodes, edges, arcs = validate_archaeology.load_source()
        summary = validate_archaeology.validate_graph(nodes, edges, arcs)
        self.assertTrue(summary["partial"])
        self.assertEqual(summary["node_count"], 16)
        self.assertEqual(summary["edge_count"], 17)
        self.assertEqual(summary["arc_count"], 2)
        self.assertEqual(summary["native_node_types"]["decision"], 6)
        self.assertEqual(summary["native_statuses"]["rejected"], 3)

    def test_committed_summary_is_current(self) -> None:
        self.assertEqual(validate_archaeology.main(), 0)


if __name__ == "__main__":
    unittest.main()
