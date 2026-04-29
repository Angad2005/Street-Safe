# Pathfinding

The routing system generates walking routes by gathering relevant data from Open Street Map (OSM) data and uses A* pathfinding algorithm to compute a path between start and end coordinates.

# System Overview

- walkableFilter : Filters OSM data to extract walkable ways and nodes

- bboxGenerator : Generates a bounding box to reduce the amount of redundant data

- snapToNearestEdge : Projects a pair of coodinates to the nearest edge provided by the OSM data

- Pathfinding : The core pathfinging algorithm that computes the complete path

- generateRoute : An overaching funciton that orchestrates the workflow to generate a route

# Data Flow

Data Manipulation

 - OSM file is passed twice:
    Pass 1 : Collect node IDs for ways that have `walkable` tags
    Pass 2 : Collect coordinates for required nodes

 - If a boundry box is provided the ways are filtered again to only provide nodes within it.

 - Using these way segments graph edges are built, ready to be used for pathfinding and coordinate snapping

Configuring start and end points

 - start and end coordinates are snapped to nearest edge
 - snapping uses parametric line segment projection

Pathfinding

 - A* algrithm is used to compute optimal path between start and end points
 - virtual nodes are used to connect snapped positions back to the graphed edges
 - edges are weighed by their distance and their proximatey to hazards gotten from the reported hazard data.


# Usage Example

```ts

import { point } from './routing/bboxGenerator';
import { generateRoute } from './routing/generateRoute';

const start = {
      lat:  52.45147198204561,
      lng:  -1.9373767151404802
    } as point;

    const end = {
      lat:  52.449745781982855,
      lng:  -1.9270555748913245
    } as point;

    console.log('Start point:', start);
    console.log('End point:', end);

    const result = await generateRoute(startPoint, endPoint);

    if (result.found)
    {
        console.log('Found path with cost of :${result.totalCost.toFixed(1)}m');
        for (const step of result.steps)
        {
            console.log('Node: ${step.nodeId} at (${step.point.lat.toFixed(4)},${step.point.lng.toFixed(4))');
        }
    }
    else
    {
        console.log('no route found');
    }
    

```

# Error Handling

`Could not snap to edge` - No edges found in region - may need to expand boundry box or check is coordinate location is permissable

`No path found` - Destination Unreachable - Verify if route exists / may need to increase boundry box

`Nan coordinates` - OSM Data is corrupted or error made in filtering file - validate data integrity and filter

# Further Optimisation

- caching OSM data for frequently used regions would allow us to decrese the time taken to access data; increaseing efficiency

- Bi-directional searching : searching from the start and the end simultaneously