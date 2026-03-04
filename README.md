# Project Genesis: The Ultimate Engineering Edition (v3.3)

A high-performance, zero-dependency flowchart engine built entirely with Vanilla JavaScript, HTML5, and SVG. Engineered by the Council of Legends to deliver precision state management, functional-oriented visual purity, and robust security.

## ✨ Features
* **Zero Dependencies**: Pure HTML, CSS, and Vanilla JavaScript.
* **Smart Vector Routing**: Arrows automatically calculate perimeter intersections to connect nodes cleanly.
* **Rich Styling**: Custom text color, borders, node fill shapes (Rectangle, Diamond, Circle), and dashed/solid line properties.
* **Export Engine**: Export pixel-perfect SVGs, or high-definition Transparent PNGs using an internal Canvas serialization pipeline.
* **Infinite Canvas**: Drag and drop nodes smoothly across an explicit DOM grid.

## 🚀 Execution
1. Navigate to the `src` directory: `cd src`
2. Start a local server (e.g., using Python): `python3 -m http.server 8080`
3. Open a browser to `http://localhost:8080`

## 🛠 Recent Updates
* **Fixed Transparent PNG Exports**: Rewrote the `<foreignObject>` serialization pipeline into native SVG `<text>` and `<tspan>` nodes to guarantee accurate PNG rasterization without background color bleeding.
* **Dynamic Arrowhead Recolor**: Changing an edge line color now explicitly regenerates dynamic SVG markers so the point of the arrow strictly matches the path stroke color.
* **Persistent Property State**: Deselecting nodes correctly restores original default black borders and resets the property tools panel.
