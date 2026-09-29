import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createCliContext } from "./context";
import { CliDependencyError } from "./errors";

const originalDataHome = process.env.XDG_DATA_HOME;

afterEach(() => {
  if (originalDataHome === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalDataHome;
});

test("provider dependencies work without initializing the Dictionary database", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-cli-provider-"));
  process.env.XDG_DATA_HOME = root;

  try {
    const dataDir = path.join(root, "dictos");
    await fs.mkdir(dataDir);
    await fs.writeFile(path.join(dataDir, "local-state.json"), "invalid");

    const context = createCliContext();
    const [first, second] = await Promise.all([
      context.getProviderDependencies(),
      context.getProviderDependencies(),
    ]);
    if (first instanceof Error) throw first;
    if (second instanceof Error) throw second;

    expect(second).toBe(first);
    const catalog = await first.modelCatalog.get();
    if (catalog instanceof Error) throw catalog;
    expect(catalog.source).toBe("bundled");
    expect(catalog.fetchedAt).toBeTruthy();

    const providers = await first.modelCatalogService.supportedProviders();
    if (providers instanceof Error) throw providers;
    expect(providers.map((provider) => provider.id)).toContain("google");

    expect(await context.getDependencies()).toBeInstanceOf(CliDependencyError);
    expect(await fs.readdir(dataDir)).not.toContain("dictos.db");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Dictionary dependencies reuse the cached provider services", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dictos-cli-full-"));
  process.env.XDG_DATA_HOME = root;

  try {
    const context = createCliContext();
    const provider = await context.getProviderDependencies();
    if (provider instanceof Error) throw provider;
    expect(await fs.readdir(path.join(root, "dictos"))).not.toContain(
      "dictos.db"
    );

    const full = await context.getDependencies();
    if (full instanceof Error) throw full;
    expect(full.providerConnectionService).toBe(
      provider.providerConnectionService
    );
    expect(full.modelCatalogService).toBe(provider.modelCatalogService);
    expect(full.modelSelectionService).toBe(provider.modelSelectionService);
    expect(full.modelCatalog).toBe(provider.modelCatalog);
    expect(full.logger).toBe(provider.logger);
    expect(await context.getDependencies()).toBe(full);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
