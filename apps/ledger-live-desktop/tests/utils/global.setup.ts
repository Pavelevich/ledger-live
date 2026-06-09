import fs from "fs";
import { execFileSync } from "child_process";
import { FullConfig } from "@playwright/test";
import { responseLogfilePath } from "./networkResponseLogger";

export default async function globalSetup(_config: FullConfig) {
  // Pre-download the Electron binary before parallel workers start.
  // On a cold cache (e.g. after a version bump), all workers racing to
  // extract the same binary simultaneously causes ETXTBSY on Linux.
  try {
    const electronPath = require("electron") as string;
    execFileSync(electronPath, ["--version"], { timeout: 10000 });
    console.log("Electron binary pre-downloaded successfully");
  } catch {
    console.log("Electron binary pre-download skipped or already cached");
  }

  if (responseLogfilePath) {
    fs.unlink(responseLogfilePath, error => {
      if (error) {
        console.log("Could not remove response.log file");
      }

      console.log("Previous response.log file removed");
    });
  }
}
