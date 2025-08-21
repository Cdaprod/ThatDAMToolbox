"use client";

import { useDevices, useStartWitness } from "@/lib/videoQueries";
import { useEffect, useState } from "react";

export default function WitnessToolPage() {
  return (
    <section className="p-8">
      <h2 className="text-3xl font-bold mb-4">Witness Tool</h2>
      <WitnessRecorder />
    </section>
  );
}

function WitnessRecorder() {
  const { data: devices } = useDevices();
  const startWitness = useStartWitness();
  const [main, setMain] = useState("");
  const [wit, setWit] = useState("");

  useEffect(() => {
    if (devices?.length) {
      setMain((m) => m || devices[0].path);
      setWit((w) => w || devices[Math.min(1, devices.length - 1)].path);
    }
  }, [devices]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <select
            className="w-full mb-2"
            value={main}
            onChange={(e) => setMain(e.target.value)}
          >
            {devices?.map((d) => (
              <option key={d.path} value={d.path}>
                {d.path}
              </option>
            ))}
          </select>
          {main && (
            <video
              className="w-full aspect-video bg-black"
              src={`/hwcapture/stream?device=${encodeURIComponent(main)}`}
              autoPlay
              muted
            />
          )}
        </div>

        <div>
          <select
            className="w-full mb-2"
            value={wit}
            onChange={(e) => setWit(e.target.value)}
          >
            {devices?.map((d) => (
              <option key={d.path} value={d.path}>
                {d.path}
              </option>
            ))}
          </select>
          {wit && (
            <video
              className="w-full aspect-video bg-black"
              src={`/hwcapture/stream?device=${encodeURIComponent(wit)}`}
              autoPlay
              muted
            />
          )}
        </div>
      </div>

      <button
        className="btn"
        onClick={() => startWitness.mutate({ main, witness: wit })}
      >
        ⚡ Start 60-s take
      </button>
    </div>
  );
}