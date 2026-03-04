// /src/app.js
const state = {
    nodes: [],
    edges: [],
    isDragging: false,
    draggedNode: null,
    offset: { x: 0, y: 0 },
    isDrawingLine: false,
    lineSourceId: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    isEditingText: false // Tracks if user is typing
};

const canvas = document.getElementById('flow-canvas');
const nodeLayer = document.getElementById('node-layer');
const edgeLayer = document.getElementById('edge-layer');
const propPanel = document.getElementById('prop-panel');

function generateId() { return 'id-' + Math.random().toString(36).substr(2, 9); }

// --- Node Creation (Upgraded to foreignObject for Multiline) ---
function createTextNode(x, y, text) {
    const id = generateId();
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'flow-node');
    group.setAttribute('transform', `translate(${x}, ${y})`);
    group.setAttribute('data-id', id);

    // Base Shape
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '120');
    rect.setAttribute('height', '50');
    rect.setAttribute('rx', '5');
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#333333');
    rect.setAttribute('stroke-width', '2');

    // Embedded HTML for Editable Multiline Text
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', '0');
    fo.setAttribute('y', '0');
    fo.setAttribute('width', '120');
    fo.setAttribute('height', '50');

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.setAttribute('class', 'node-text-container');
    div.innerText = text;

    // Text Editing Event Handlers
    div.addEventListener('mousedown', (e) => {
        if (state.isEditingText) e.stopPropagation(); // Allow text selection
    });
    div.addEventListener('focus', () => state.isEditingText = true);
    div.addEventListener('blur', () => {
        state.isEditingText = false;
        div.classList.remove('editing');
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
    });
    div.addEventListener('input', (e) => {
        const nodeData = state.nodes.find(n => n.id === id);
        if (nodeData) {
            nodeData.content = e.target.innerText;
            if (document.getElementById('node-text')) {
                document.getElementById('node-text').value = nodeData.content;
            }
        }
    });

    fo.appendChild(div);
    group.appendChild(rect);
    group.appendChild(fo);
    nodeLayer.appendChild(group);

    group.addEventListener('mousedown', (e) => handleNodeInteraction(e, id));
    group.addEventListener('dblclick', (e) => {
        if (!state.isDrawingLine) {
            e.stopPropagation();
            div.classList.add('editing');
            div.focus();
            const range = document.createRange();
            range.selectNodeContents(div);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });

    state.nodes.push({ id, x, y, type: 'text', content: text, width: 120, height: 50 });
}

function createImageNode(x, y, dataUrl) {
    const id = generateId();
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'flow-node');
    group.setAttribute('transform', `translate(${x}, ${y})`);
    group.setAttribute('data-id', id);

    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('href', dataUrl);
    img.setAttribute('width', '100');
    img.setAttribute('height', '100');

    group.appendChild(img);
    nodeLayer.appendChild(group);

    group.addEventListener('mousedown', (e) => handleNodeInteraction(e, id));
    state.nodes.push({ id, x, y, type: 'image', width: 100, height: 100 });
}

// --- Utilities ---
function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return '#333333';
    return '#' + match.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
}

function updateEdgeMarker(line, color) {
    if (line.getAttribute('marker-end')) {
        const rawColor = color.replace('#', '');
        const id = `arrowhead-${rawColor}`;
        let marker = document.getElementById(id);
        if (!marker) {
            marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', id);
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', color);

            marker.appendChild(polygon);
            document.querySelector('defs').appendChild(marker);
        }
        line.setAttribute('marker-end', `url(#${id})`);
    }
}

// --- Interaction & Selection ---
function handleNodeInteraction(e, id) {
    if (state.isDrawingLine) {
        if (!state.lineSourceId) {
            state.lineSourceId = id;
            const shape = e.currentTarget.querySelector('rect, circle, polygon');
            if (shape) {
                // Remember original stroke so resetDrawingState can restore it
                if (!e.currentTarget.dataset.originalStroke) {
                    e.currentTarget.dataset.originalStroke = shape.getAttribute('stroke') || '#333333';
                }
                shape.setAttribute('stroke', '#007bff');
            }
        } else if (state.lineSourceId !== id) {
            createEdge(state.lineSourceId, id);
            resetDrawingState();
        }
    } else {
        selectNode(id, e.currentTarget);
        startDrag(e);
    }
}

function selectNode(id, element) {
    if (document.activeElement) document.activeElement.blur();

    clearSelection();
    state.selectedNodeId = id;

    const shape = element.querySelector('rect, circle, polygon');
    let originalStroke = '#333333';

    if (shape) {
        // Store original stroke so clearSelection can restore it
        originalStroke = shape.getAttribute('stroke') || '#333333';
        element.dataset.originalStroke = originalStroke;

        shape.setAttribute('stroke-width', '4');
        shape.setAttribute('stroke', '#007bff');
    }

    const nodeData = state.nodes.find(n => n.id === id);
    if (nodeData && nodeData.type === 'text') {
        propPanel.style.display = 'block';
        document.getElementById('node-props').style.display = 'block';
        document.getElementById('edge-props').style.display = 'none';

        document.getElementById('node-text').value = nodeData.content;
        document.getElementById('node-width').value = nodeData.width;
        document.getElementById('node-height').value = nodeData.height;

        if (shape) {
            document.getElementById('node-fill').value = shape.getAttribute('fill') || '#ffffff';
            document.getElementById('node-border').value = originalStroke;

            // Set shape dropdown
            const tagName = shape.tagName.toLowerCase();
            const shapeSelect = document.getElementById('shape-select');
            if (tagName === 'rect') shapeSelect.value = 'rect';
            else if (tagName === 'circle') shapeSelect.value = 'circle';
            else if (tagName === 'polygon') shapeSelect.value = 'diamond';
        }

        const div = element.querySelector('.node-text-container');
        if (div) {
            document.getElementById('font-size').value = parseInt(div.style.fontSize) || 14;
            document.getElementById('node-text-color').value = rgbToHex(div.style.color || '#333333');
        }
    }
}

function selectEdge(id, lineElement) {
    clearSelection();
    state.selectedEdgeId = id;

    lineElement.dataset.originalStroke = lineElement.getAttribute('stroke') || '#333333';

    lineElement.setAttribute('stroke', '#007bff');
    lineElement.setAttribute('stroke-width', '4');
    if (lineElement.hasAttribute('marker-end')) {
        updateEdgeMarker(lineElement, '#007bff');
    }

    propPanel.style.display = 'block';
    document.getElementById('node-props').style.display = 'none';
    document.getElementById('edge-props').style.display = 'block';

    document.getElementById('edge-color').value = rgbToHex(lineElement.dataset.originalStroke);

    const styleSelect = document.getElementById('edge-style');
    if (lineElement.hasAttribute('stroke-dasharray')) styleSelect.value = 'dashed';
    else styleSelect.value = 'solid';

    const arrowSelect = document.getElementById('edge-arrow');
    if (lineElement.hasAttribute('marker-end')) arrowSelect.value = 'arrow';
    else arrowSelect.value = 'none';
}

function clearSelection() {
    if (state.selectedNodeId) {
        const prev = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
        if (prev) {
            const shape = prev.querySelector('rect, circle, polygon');
            if (shape) {
                shape.setAttribute('stroke-width', '2');
                shape.setAttribute('stroke', prev.dataset.originalStroke || '#333333');
            }
        }
    }
    if (state.selectedEdgeId) {
        const prevLine = document.getElementById(state.selectedEdgeId);
        if (prevLine) {
            const color = prevLine.dataset.originalStroke || '#333333';
            prevLine.setAttribute('stroke-width', '2');
            prevLine.setAttribute('stroke', color);
            if (prevLine.hasAttribute('marker-end')) {
                updateEdgeMarker(prevLine, color);
            }
        }
    }
    state.selectedNodeId = null;
    state.selectedEdgeId = null;
    propPanel.style.display = 'none';
}

function resetDrawingState() {
    if (state.lineSourceId) {
        const sourceNode = document.querySelector(`[data-id="${state.lineSourceId}"]`);
        if (sourceNode) {
            const shape = sourceNode.querySelector('rect, circle, polygon');
            if (shape) shape.setAttribute('stroke', sourceNode.dataset.originalStroke || '#333333');
        }
    }
    state.isDrawingLine = false;
    state.lineSourceId = null;
    document.getElementById('draw-line-btn').style.background = '#fff';
    clearSelection();
}

// --- Drag Physics ---
function startDrag(e) {
    if (state.isEditingText) return; // Prevent drag if typing
    state.isDragging = true;
    state.draggedNode = e.currentTarget;
    const ctm = canvas.getScreenCTM();
    const transform = state.draggedNode.getAttribute('transform');
    const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transform);

    state.offset.x = (e.clientX - ctm.e) / ctm.a - parseFloat(match[1]);
    state.offset.y = (e.clientY - ctm.f) / ctm.d - parseFloat(match[2]);
}

function drag(e) {
    if (state.isDragging && state.draggedNode) {
        e.preventDefault();
        const ctm = canvas.getScreenCTM();
        const x = (e.clientX - ctm.e) / ctm.a - state.offset.x;
        const y = (e.clientY - ctm.f) / ctm.d - state.offset.y;

        state.draggedNode.setAttribute('transform', `translate(${x}, ${y})`);

        const id = state.draggedNode.getAttribute('data-id');
        const nodeData = state.nodes.find(n => n.id === id);
        if (nodeData) {
            nodeData.x = x;
            nodeData.y = y;
        }
        renderEdges();
    }
}

function endDrag() {
    state.isDragging = false;
    state.draggedNode = null;
}

// --- Edge Routing (Upgraded Vector Math) ---
function createEdge(sourceId, targetId) {
    const edgeId = `edge-${sourceId}-${targetId}`;
    state.edges.push({ id: edgeId, source: sourceId, target: targetId });

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', edgeId);
    line.setAttribute('stroke', '#333333');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    updateEdgeMarker(line, '#333333');

    line.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectEdge(edgeId, line);
    });

    edgeLayer.appendChild(line);
    renderEdges();
}

function renderEdges() {
    state.edges.forEach(edge => {
        const sourceNode = state.nodes.find(n => n.id === edge.source);
        const targetNode = state.nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
            const lineEl = document.getElementById(edge.id);
            if (lineEl) {
                // Centers
                const cx1 = sourceNode.x + sourceNode.width / 2;
                const cy1 = sourceNode.y + sourceNode.height / 2;
                const cx2 = targetNode.x + targetNode.width / 2;
                const cy2 = targetNode.y + targetNode.height / 2;

                // Vector Math: Find intersection with target's bounding box to keep arrow visible
                const dx = cx1 - cx2;
                const dy = cy1 - cy2;
                let tx2 = cx2, ty2 = cy2;

                if (dx !== 0 || dy !== 0) {
                    // Scale factor 't' based on half-width and half-height
                    const t = Math.min((targetNode.width / 2) / Math.abs(dx), (targetNode.height / 2) / Math.abs(dy));
                    tx2 = cx2 + dx * t;
                    ty2 = cy2 + dy * t;
                }

                lineEl.setAttribute('x1', cx1);
                lineEl.setAttribute('y1', cy1);
                lineEl.setAttribute('x2', tx2);
                lineEl.setAttribute('y2', ty2);
            }
        }
    });
}

// --- Deletion Logic ---
function deleteSelected() {
    if (state.selectedNodeId) {
        const el = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
        if (el) el.remove();
        state.nodes = state.nodes.filter(n => n.id !== state.selectedNodeId);

        const connectedEdges = state.edges.filter(e => e.source === state.selectedNodeId || e.target === state.selectedNodeId);
        connectedEdges.forEach(e => {
            const lineEl = document.getElementById(e.id);
            if (lineEl) lineEl.remove();
        });
        state.edges = state.edges.filter(e => e.source !== state.selectedNodeId && e.target !== state.selectedNodeId);
        clearSelection();
    } else if (state.selectedEdgeId) {
        const el = document.getElementById(state.selectedEdgeId);
        if (el) el.remove();
        state.edges = state.edges.filter(e => e.id !== state.selectedEdgeId);
        clearSelection();
    }
}

function applyInlineStylesForExport(clone) {
    // Convert foreignObject (HTML) to native SVG <text> elements for reliable rendering in PNGs/Canvas
    clone.querySelectorAll('foreignObject').forEach(fo => {
        const div = fo.querySelector('.node-text-container');
        if (!div) return;

        const x = parseFloat(fo.getAttribute('x')) || 0;
        const y = parseFloat(fo.getAttribute('y')) || 0;
        const width = parseFloat(fo.getAttribute('width')) || 120;
        const height = parseFloat(fo.getAttribute('height')) || 50;

        const text = div.innerText.trim();
        const lines = text.split('\n');

        const color = div.style.color || '#333333';
        const fontSizeStr = div.style.fontSize || '14px';
        const fontSize = parseInt(fontSizeStr);

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('fill', color);
        textEl.setAttribute('font-size', fontSizeStr);
        textEl.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
        textEl.setAttribute('font-weight', '500');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'middle');

        // Center horizontally in the shape
        const cx = x + width / 2;

        // Approximate vertical centering for multiline
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = lines.length * lineHeight;
        const startY = y + height / 2 - totalTextHeight / 2 + lineHeight / 2;

        lines.forEach((lineText, index) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', cx);
            tspan.setAttribute('y', startY + (index * lineHeight));
            tspan.textContent = lineText;
            textEl.appendChild(tspan);
        });

        // Replace foreignObject with our new pure SVG text
        fo.parentNode.replaceChild(textEl, fo);
    });
}

document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !state.isEditingText && e.target.tagName !== 'INPUT') {
        deleteSelected();
    }
});
document.getElementById('delete-btn').addEventListener('click', deleteSelected);

// --- Event Listeners ---
canvas.addEventListener('mousedown', (e) => {
    if (e.target.id === 'flow-canvas' || e.target.id === 'bg-grid') {
        clearSelection();
        if (document.activeElement) document.activeElement.blur(); // Dismiss text editor
    }
});
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('mouseleave', endDrag);

document.getElementById('add-text-btn').addEventListener('click', () => createTextNode(100, 100, 'New Process'));
document.getElementById('draw-line-btn').addEventListener('click', () => {
    state.isDrawingLine = !state.isDrawingLine;
    document.getElementById('draw-line-btn').style.background = state.isDrawingLine ? '#e0e0e0' : '#fff';
    state.lineSourceId = null;
});

document.getElementById('add-img-btn').addEventListener('click', () => document.getElementById('img-upload').click());
document.getElementById('img-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => createImageNode(100, 100, event.target.result);
    reader.readAsDataURL(file);
});

// --- Node Mutations ---
function updateNodeShape(width, height) {
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    if (!element) return;

    const shape = element.querySelector('rect, circle, polygon');
    const fo = element.querySelector('foreignObject');
    const shapeType = document.getElementById('shape-select').value;

    if (shape) element.removeChild(shape);

    // Resize the text container
    if (fo) {
        fo.setAttribute('width', width);
        fo.setAttribute('height', height);
    }

    let newShape;
    if (shapeType === 'circle') {
        newShape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        newShape.setAttribute('r', Math.min(width, height) / 2);
        newShape.setAttribute('cx', width / 2);
        newShape.setAttribute('cy', height / 2);
    } else if (shapeType === 'rect') {
        newShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        newShape.setAttribute('width', width);
        newShape.setAttribute('height', height);
        newShape.setAttribute('rx', '5');
    } else if (shapeType === 'diamond') {
        newShape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        newShape.setAttribute('points', `0,${height / 2} ${width / 2},0 ${width},${height / 2} ${width / 2},${height}`);
    }

    newShape.setAttribute('fill', document.getElementById('node-fill').value);
    newShape.setAttribute('stroke', '#007bff');
    newShape.setAttribute('stroke-width', '4');

    element.insertBefore(newShape, fo);
}

document.getElementById('node-text').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    const nodeData = state.nodes.find(n => n.id === state.selectedNodeId);
    if (element && nodeData) {
        nodeData.content = e.target.value;
        const div = element.querySelector('.node-text-container');
        if (div) div.innerText = e.target.value;
    }
});

document.getElementById('node-width').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const nodeData = state.nodes.find(n => n.id === state.selectedNodeId);
    if (nodeData) {
        nodeData.width = parseInt(e.target.value);
        updateNodeShape(nodeData.width, nodeData.height);
        renderEdges();
    }
});

document.getElementById('node-height').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const nodeData = state.nodes.find(n => n.id === state.selectedNodeId);
    if (nodeData) {
        nodeData.height = parseInt(e.target.value);
        updateNodeShape(nodeData.width, nodeData.height);
        renderEdges();
    }
});

document.getElementById('shape-select').addEventListener('change', () => {
    if (!state.selectedNodeId) return;
    const nodeData = state.nodes.find(n => n.id === state.selectedNodeId);
    if (nodeData) updateNodeShape(nodeData.width, nodeData.height);
});

document.getElementById('font-size').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    if (element) {
        const div = element.querySelector('.node-text-container');
        if (div) div.style.fontSize = `${e.target.value}px`;
    }
});

document.getElementById('node-fill').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    if (element) element.querySelector('rect, circle, polygon').setAttribute('fill', e.target.value);
});

document.getElementById('node-border').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    if (element) {
        element.dataset.originalStroke = e.target.value;
    }
});

document.getElementById('node-text-color').addEventListener('input', (e) => {
    if (!state.selectedNodeId) return;
    const element = document.querySelector(`[data-id="${state.selectedNodeId}"]`);
    if (element) {
        const div = element.querySelector('.node-text-container');
        if (div) div.style.color = e.target.value;
    }
});

// --- Edge Mutations ---
document.getElementById('edge-color').addEventListener('input', (e) => {
    if (!state.selectedEdgeId) return;
    const line = document.getElementById(state.selectedEdgeId);
    if (line) {
        line.dataset.originalStroke = e.target.value;
        line.setAttribute('stroke', e.target.value); // Apply to visually update immediately
        if (line.hasAttribute('marker-end')) {
            updateEdgeMarker(line, e.target.value);
        }
    }
});

document.getElementById('edge-style').addEventListener('change', (e) => {
    if (!state.selectedEdgeId) return;
    const line = document.getElementById(state.selectedEdgeId);
    if (line) {
        if (e.target.value === 'dashed') line.setAttribute('stroke-dasharray', '5,5');
        else line.removeAttribute('stroke-dasharray');
    }
});

document.getElementById('edge-arrow').addEventListener('change', (e) => {
    if (!state.selectedEdgeId) return;
    const line = document.getElementById(state.selectedEdgeId);
    if (line) {
        if (e.target.value === 'arrow') {
            line.setAttribute('marker-end', 'url(#arrowhead)');
            updateEdgeMarker(line, '#007bff');
        } else {
            line.removeAttribute('marker-end');
        }
    }
});

// --- Upgraded SVG Export ---
document.getElementById('export-svg-btn').addEventListener('click', () => {
    clearSelection();
    const cloneCanvas = canvas.cloneNode(true);

    const bgGrid = cloneCanvas.querySelector('#bg-grid');
    if (bgGrid) bgGrid.remove();

    applyInlineStylesForExport(cloneCanvas); // Fix text rendering

    let source = new XMLSerializer().serializeToString(cloneCanvas);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    const downloadLink = document.createElement("a");
    downloadLink.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    downloadLink.download = "genesis-flowchart.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
});

// --- New Native PNG Rasterization Pipeline ---
document.getElementById('export-png-btn').addEventListener('click', () => {
    clearSelection();
    const cloneCanvas = canvas.cloneNode(true);

    const bgGrid = cloneCanvas.querySelector('#bg-grid');
    if (bgGrid) bgGrid.remove();

    const bbox = canvas.getBoundingClientRect();
    cloneCanvas.setAttribute('width', bbox.width);
    cloneCanvas.setAttribute('height', bbox.height);

    applyInlineStylesForExport(cloneCanvas); // Fix text rendering for the canvas draw

    let source = new XMLSerializer().serializeToString(cloneCanvas);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    // Create an Image from the SVG source
    const img = new Image();
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = function () {
        // Create an invisible canvas to draw the image
        const canvasElem = document.createElement('canvas');
        canvasElem.width = bbox.width;
        canvasElem.height = bbox.height;

        const ctx = canvasElem.getContext('2d');

        // Draw the SVG image onto the HTML5 Canvas (transparent background)
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        // Convert the Canvas to a PNG Data URL
        const imgURI = canvasElem.toDataURL('image/png');

        // Trigger Download
        const downloadLink = document.createElement('a');
        downloadLink.href = imgURI;
        downloadLink.download = 'genesis-flowchart.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    img.src = url;
});
