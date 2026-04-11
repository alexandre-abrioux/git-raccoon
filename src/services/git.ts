const runGit = async (
  ...args: string[]
): Promise<{ stdout: string; success: boolean }> => {
  const cmd = new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const result = await cmd.output();
  return {
    stdout: new TextDecoder().decode(result.stdout),
    success: result.success,
  };
};

export const isGitRepo = async (): Promise<boolean> => {
  return (await runGit("rev-parse", "--is-inside-work-tree")).success;
};

export const assertGitRepo = async (): Promise<void> => {
  if (!(await isGitRepo())) {
    throw new Error("This command must be run inside a Git repository.");
  }
};

export const getBranchName = async (): Promise<string> => {
  return (await runGit("rev-parse", "--abbrev-ref", "HEAD")).stdout.trim();
};

export const getStagedDiff = async (): Promise<string> => {
  return (await runGit("--no-pager", "diff", "--staged", "--no-color")).stdout
    .replace(/\r/g, "");
};

export const getUnstagedDiff = async (): Promise<string> => {
  return (await runGit("--no-pager", "diff", "--no-color")).stdout.replace(
    /\r/g,
    "",
  );
};

export const gitAddAll = async (): Promise<void> => {
  await runGit("add", ".");
};

export const gitCheckoutNewBranch = async (name: string): Promise<void> => {
  const cmd = new Deno.Command("git", {
    args: ["checkout", "-b", name],
    stdout: "inherit",
    stderr: "inherit",
  });
  const result = await cmd.output();
  if (!result.success) throw new Error(`git checkout -b ${name} failed`);
};

export const gitCommit = async (message: string): Promise<void> => {
  const cmd = new Deno.Command("git", {
    args: ["commit", "-m", message],
    stdout: "inherit",
    stderr: "inherit",
  });
  const result = await cmd.output();
  if (!result.success) throw new Error("git commit failed");
};

export const gitCommitWithEdit = async (message: string): Promise<void> => {
  const cmd = new Deno.Command("git", {
    args: ["commit", "-m", message, "--edit"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const result = await cmd.output();
  if (!result.success) throw new Error("git commit failed");
};
