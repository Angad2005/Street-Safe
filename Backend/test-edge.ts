import { filterWalkable } from "./src/routing/walkableFilter";
import path from "path";

async function main() {
    const filePath = path.join(process.cwd(), 'data', 'main.osm.pbf');
    const { edges, nodeMap } = await filterWalkable(filePath);
    
    const startEdge = edges.find(e => e.nodeA === 2705009721 || e.nodeB === 2705009721);
    console.log("Found edge:", startEdge);

    const related = edges.filter(e => e.nodeA === 2705009721 || e.nodeB === 2705009721 || e.nodeA === 2705009723 || e.nodeB === 2705009723);
    console.log("Related edges:", related.length);
}

main();
