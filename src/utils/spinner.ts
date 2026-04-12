import { tty } from "@cliffy/ansi/tty";
export const SPINNER_DOWNLOAD_CHARS = ["\u2631", "\u2632", "\u2634"];
export const SPINNER_ELLIPSIS_CHARS = [
  "...",
  ".. ",
  ".  ",
  "   ",
  ".  ",
  ".. ",
];

export class Spinner {
  private timer: number | null = null;
  private i = 0;
  private first = true;

  constructor(
    private message: string,
    private readonly type: "ellipsis" | "download" = "ellipsis",
  ) {}

  private loop() {
    const chars =
      this.type === "ellipsis"
        ? SPINNER_ELLIPSIS_CHARS
        : SPINNER_DOWNLOAD_CHARS;
    const char = chars[this.i];
    if (!this.first) {
      tty.cursorMove(0, -1);
      tty.eraseLine();
    }
    console.log(
      `🦝 ${this.message.replace("{spinner}", char)}${" ".repeat(10)}`,
    );
    this.first = false;
    this.i++;
    if (this.i >= chars.length) this.i = 0;
  }

  public start() {
    this.i = 0;
    this.first = true;
    this.loop();
    this.timer = setInterval(
      this.loop.bind(this),
      this.type === "ellipsis" ? 200 : 100,
    );
  }

  public update(message: string) {
    this.message = message;
  }

  public stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    tty.cursorMove(0, -1);
    tty.eraseLine();
  }
}
