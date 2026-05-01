import { ConsolePosition, createCliRenderer, KeyEvent } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { LibSqlCaptureRepository } from "@dictos/adapters";
import { CaptureService, type Capture } from "@dictos/core";
import { useEffect, useState } from "react";

const bootstrap = async () => {
  const repo = new LibSqlCaptureRepository("file:./dictos.db");
  repo.initialize();

  const captureService = new CaptureService(repo);

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 30,
    },
  });
  createRoot(renderer).render(<App captureService={captureService} />);
};

interface Props {
  captureService: CaptureService;
}

function App({ captureService }: Props) {
  const [value, setValue] = useState("");
  const [captures, setCaptures] = useState<Capture[] | null>();

  useEffect(() => {
    (async () => {
      const allCaptures = await captureService.getAll();

      if (allCaptures === null) return;
      setCaptures(allCaptures);
    })();
  }, [value]);

  console.log("value:", value);
  const submitCaptureOnEnter = (key: KeyEvent) => {
    if (key.name !== "return") return;

    captureService.createCapture(value, 0);
  };

  return (
    <box
      flexDirection="column"
      gap={10}
    >
      <input
        focused
        value={value}
        onChange={setValue}
        // use onSubmit
        onKeyDown={submitCaptureOnEnter}
      />
      <box
        borderStyle="double"
        flexDirection="column"
        height={50}
      >
        {captures?.map((capture, i) => (
          <text key={i}>{capture.text}</text>
        ))}
      </box>
    </box>
  );
}

bootstrap().catch(console.error);
