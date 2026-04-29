import { generateRoute } from "./src/routing/generateRoute";

async function main() {
    const start = { lat: 52.44645919636494, lng: -1.9364305947475393 };
    const end = { lat: 52.5064953, lng: -1.9271568 };

    try {
        console.log("Starting routing test...");
        console.time("generateRoute");
        const res = await generateRoute(start, end);
        console.timeEnd("generateRoute");
        console.log("Result:", res.found);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
