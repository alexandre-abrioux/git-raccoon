export const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private timer: number | null = null;
  private i = 0;
  private readonly enc = new TextEncoder();

  constructor(private readonly message: string) {}

  start() {
    this.i = 0;
    this.timer = setInterval(() => {
      const char = SPINNER_CHARS[this.i % SPINNER_CHARS.length];
      Deno.stderr.writeSync(this.enc.encode(`\r${char} ${this.message}`));
      this.i++;
    }, 100);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    Deno.stderr.writeSync(this.enc.encode("\r" + " ".repeat(50) + "\r"));
  }
}
