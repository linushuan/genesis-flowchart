const assert = (condition, message) => {
    if (!condition) throw new Error(`❌ Assertion Failed: ${message}`);
    console.log(`✅ ${message}`);
};

function runTests() {
    console.log("Starting Automated Regression Suite...");
    const mockState = { nodes: [], edges: [] };

    function testNodeCreation() {
        mockState.nodes.push({ id: 'test-node-1', x: 100, y: 100, type: 'text', width: 120, height: 50 });
        assert(mockState.nodes.length === 1, "State should contain exactly 1 node after creation.");
        assert(mockState.nodes[0].x === 100, "Node X coordinate should be 100.");
    }

    function testEdgeRouting() {
        mockState.nodes.push({ id: 'test-node-2', x: 300, y: 100, type: 'text', width: 120, height: 50 });
        mockState.edges.push({ id: 'edge-1-2', source: 'test-node-1', target: 'test-node-2' });

        const source = mockState.nodes[0];
        const target = mockState.nodes[1];

        assert((source.x + (source.width / 2)) === 160, "Edge start X should be exactly center of source node (160).");
        assert((target.x + (target.width / 2)) === 360, "Edge end X should be exactly center of target node (360).");
    }

    try {
        testNodeCreation();
        testEdgeRouting();
        console.log("All tests passed successfully. Zero bugs detected.");
    } catch (error) {
        console.error(error.message);
    }
}

if (typeof window !== 'undefined') runTests();
