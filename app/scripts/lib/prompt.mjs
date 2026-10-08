import readline from "node:readline"

// Ask a question on the terminal. `hidden` keeps passwords off the screen.
export function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
    let muted = false
    rl._writeToOutput = (text) => {
      if (!muted) process.stdout.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write("\n")
      resolve(answer)
    })
    muted = hidden
  })
}

// An empty password is valid, so only "was it provided at all" matters.
export async function passwordFromEnvOrPrompt(envName, question) {
  const fromEnv = process.env[envName]
  if (fromEnv !== undefined) return fromEnv
  if (!process.stdin.isTTY) {
    console.error(`No terminal to ask for a password. Set ${envName} (an empty value is fine).`)
    process.exit(1)
  }
  return ask(question, { hidden: true })
}
