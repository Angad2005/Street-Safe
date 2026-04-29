import { filterWalkable } from "./src/routing/walkableFilter";
import path from "path";

async function main() {
    const filePath = path.join(process.cwd(), 'data', 'main.osm.pbf');
    const { edges } = await filterWalkable(filePath);
    
    // Build adjacency list
    const adj = new Map<number, number[]>();
    for (const e of edges) {
        if (!adj.has(e.nodeA)) adj.set(e.nodeA, []);
        if (!adj.has(e.nodeB)) adj.set(e.nodeB, []);
        adj.get(e.nodeA)!.push(e.nodeB);
        adj.get(e.nodeB)!.push(e.nodeA);
    }

    function getCCSize(startNode: number): number {
        if (!adj.has(startNode)) return 0;
        let count = 0;
        const q = [startNode];
        const visited = new Set<number>();
        visited.add(startNode);
        
        while (q.length > 0) {
            const curr = q.pop()!;
            count++;
            for (const nxt of adj.get(curr) || []) {
                if (!visited.has(nxt)) {
                    visited.add(nxt);
                    q.push(nxt);
                }
            }
        }
        return count;
    }

    console.log("Component size for start node 2705009721:", getCCSize(2705009721));
    console.log("Component size for end node 4567210206 (if exists):", getCCSize(4567210206)); // Some random node
}

main();
