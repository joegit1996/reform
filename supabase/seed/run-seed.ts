import { seedMountaineering } from "./seed_mountaineering";

seedMountaineering()
  .then(() => {
    console.log("Seed complete.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
