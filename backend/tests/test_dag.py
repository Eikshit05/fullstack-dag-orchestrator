from main import is_dag, NodeModel, EdgeModel


def N(*ids):
    return [NodeModel(id=i) for i in ids]


def E(*pairs):
    return [EdgeModel(source=s, target=t) for s, t in pairs]


def test_empty_graph_is_dag():
    assert is_dag(N(), E()) is True


def test_simple_chain_is_dag():
    assert is_dag(N('a', 'b', 'c'), E(('a', 'b'), ('b', 'c'))) is True


def test_self_loop_is_not_dag():
    assert is_dag(N('a'), E(('a', 'a'))) is False


def test_two_cycle_is_not_dag():
    assert is_dag(N('a', 'b'), E(('a', 'b'), ('b', 'a'))) is False


def test_diamond_is_dag():
    assert is_dag(N('a', 'b', 'c', 'd'),
                  E(('a', 'b'), ('a', 'c'), ('b', 'd'), ('c', 'd'))) is True


def test_disconnected_components_is_dag():
    assert is_dag(N('a', 'b', 'c', 'd'), E(('a', 'b'), ('c', 'd'))) is True


def test_isolated_node_does_not_falsely_fail():
    assert is_dag(N('a', 'b', 'c'), E(('a', 'b'))) is True
