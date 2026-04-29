import { PathResult, PathStep, astar} from "./Pathfinding"
import { bboxFromPoint, bboxFromPoints, point } from "./bboxGenerator"
import { snapToNearestEdge } from "./snapToNearestEdge"
import { filterWalkable, bboxInterface, bboxQuery } from "./walkableFilter"

import path from 'path';
import fs from "fs";

const OSM_FILE_PATH = path.join(process.cwd(), 'data', 'main.osm.pbf');

let filteredWalkablePromise: ReturnType<typeof filterWalkable> | null = null;

function getFilteredWalkable() {
    if (!filteredWalkablePromise) {
        if (!fs.existsSync(OSM_FILE_PATH)) {
            throw new Error(`OSM file not found: ${OSM_FILE_PATH}. Run 'npm run setup -- --osm' to download it.`);
        }
        filteredWalkablePromise = filterWalkable(OSM_FILE_PATH);
    }
    return filteredWalkablePromise;
}

export async function generateRoute(GPSLocation: point, Desination: point) : Promise<PathResult>
{
    const bbox = bboxFromPoints([GPSLocation, Desination]);
    const query: bboxQuery = { bbox }

    const awaitFilteredWalkable = await getFilteredWalkable();

    let snapStart = snapToNearestEdge(GPSLocation, awaitFilteredWalkable.edges);
    let snapEnd   = snapToNearestEdge(Desination, awaitFilteredWalkable.edges);

    if (!snapStart || !snapEnd) throw new Error("Could not snap to any edge");


    const result = astar(awaitFilteredWalkable.edges, snapStart, snapEnd);

    if (result.found)
    {
        console.log(`Path found! Cost: ${result.totalCost.toFixed(1)} m`);
        for (const step of result.steps)
        {
        console.log(`node ${step.nodeId}`, step.point, step.via ? `via way ${step.via.wayId}` : "(start)");
        }

    } else
    {
        console.log("No path found.");
    }

    return result;
}
