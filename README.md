# my-codex

`my-codex` is a lightweight tool that lets you activate your custom Codex anywhere, on any server, at any time.

The intended one-line UX is:

```sh
npx -y my-codex use <your-github-name>
```

`my-codex` reads the Codex configuration stored in your GitHub fork and automatically opens a temporary shell with your Codex session configured.

## Quick Start

The simplest setup is:

1. Fork this repository.
2. Generate an encrypted profile from your existing local Codex installation.
3. Commit that encrypted profile to your fork.
4. Use your GitHub username from any machine.

Fork this repo here:

- Fork: [github.com/Zqysl/my-codex/fork](https://github.com/Zqysl/my-codex/fork)
- Keep the fork name as `my-codex`
- Make the fork public

## How It Works

`my-codex` uses a fixed GitHub convention so the command can stay short.

Default profile lookup:

```text
<your-github-name>
  -> https://raw.githubusercontent.com/<your-github-name>/my-codex/main/profiles/default.age
```

Named profile lookup:

```text
<your-github-name>/<profile>
  -> https://raw.githubusercontent.com/<your-github-name>/my-codex/main/profiles/<profile>.age
```

Examples:

```sh
npx -y my-codex use zqysl
npx -y my-codex use zqysl/work
npx -y my-codex exec zqysl -- codex login status
```

## Create Your Profile From Existing Codex Config

You do not need to hand-write JSON.

`my-codex encrypt` reads:

- `~/.codex/auth.json`
- `~/.codex/config.toml`

and turns them into one encrypted `age` profile file.

### From your fork

Clone your fork locally, then run:

```sh
pnpm install
MY_CODEX_PASSPHRASE='your-passphrase' pnpm dev -- encrypt
```

By default, that writes:

```text
profiles/default.age
```

Then commit and push:

```sh
git add profiles/default.age
git commit -m "feat(profile): add default age profile"
git push
```

### Custom profile names

To create a named profile:

```sh
MY_CODEX_PASSPHRASE='your-passphrase' pnpm dev -- encrypt ./profiles/work.age --name work
```

To create an isolated profile:

```sh
MY_CODEX_PASSPHRASE='your-passphrase' pnpm dev -- encrypt ./profiles/work.age --name work --mode isolated
```

To import from a custom Codex directory:

```sh
MY_CODEX_PASSPHRASE='your-passphrase' pnpm dev -- encrypt --codex-home /path/to/.codex
```

## Use It From Any Server

Once your fork contains `profiles/default.age`, usage is short.

Open a temporary shell:

```sh
npx -y my-codex use <github-user>
```

Open a temporary shell with a named profile:

```sh
npx -y my-codex use <github-user>/<profile>
```

Run a single command instead of entering a shell:

```sh
npx -y my-codex exec <github-user> -- codex
```

### What `use` does

- downloads your encrypted `.age` profile from GitHub
- prompts for the passphrase, or reads `MY_CODEX_PASSPHRASE`
- decrypts the profile locally
- creates a temporary `codex` wrapper with the right `-c` overrides
- opens a child shell where that profile is active
- cleans up when you exit the shell

## Commands

```sh
my-codex use <owner>
my-codex use <owner>/<profile>
my-codex exec <owner> -- codex
my-codex encrypt [output]
my-codex doctor
```

### `encrypt`

`encrypt` imports your current Codex setup and writes an encrypted `age` file.

```sh
my-codex encrypt [output] --name default --mode shared
```

Useful options:

- `--name <name>`: profile name, defaults to `default`
- `--mode <shared|isolated>`: whether to reuse `~/.codex` or allocate a temporary `CODEX_HOME`
- `--codex-home <path>`: import from a non-default Codex directory

### `use`

`use` opens a temporary child shell with your profile activated.

### `exec`

`exec` runs one command with your profile activated, without opening an interactive shell.

### `doctor`

`doctor` prints local runtime details such as the `codex` path and current shell.

## What Gets Imported

When you run `encrypt`, `my-codex` imports:

- `auth.json` -> environment variables such as `OPENAI_API_KEY`
- `config.toml` -> `codex -c key=value` overrides
- `[model_providers.*]` -> provider definitions used to rebuild provider config at runtime

This means the common path is:

1. configure Codex normally on your own machine
2. run `my-codex encrypt`
3. commit only the encrypted `.age` file
4. activate that config anywhere else

## Shared vs Isolated

- `shared`: reuse the existing `~/.codex` on the target machine
- `isolated`: allocate a temporary `CODEX_HOME` for the activated shell

Use `shared` if you only want to switch runtime settings such as:

- `OPENAI_API_KEY`
- `base_url`
- `model_provider`
- `model`

Use `isolated` if you also want temporary state separation.

## Security Model

- GitHub stores only encrypted profile files
- profiles are encrypted using standard passphrase-based `age`
- the passphrase is read from `MY_CODEX_PASSPHRASE` or prompted interactively
- decryption happens locally on the machine where you run `my-codex`
- `use` does not modify the parent shell environment
- `use` starts a temporary child shell and cleans up when that shell exits

Important tradeoff:

- this design avoids requiring your own server
- but whoever activates the profile still needs the passphrase

## Repository Convention

`my-codex` currently assumes:

- repo name: `my-codex`
- branch: `main`
- profile directory: `profiles/`
- file extension: `.age`

That convention is what makes this possible:

```sh
npx -y my-codex use zqysl
```

without a longer locator syntax.

## Current State

Today, the repository already includes:

- a TypeScript + pnpm CLI
- passphrase-based `age` profile encryption
- GitHub raw profile loading
- `use`, `exec`, `encrypt`, and `doctor`
- automatic import from `~/.codex/auth.json` and `~/.codex/config.toml`
- tests
- CI

If the package is not yet published to npm, use it from source inside a clone:

```sh
pnpm dev -- use <github-user>
pnpm dev -- exec <github-user> -- codex
```

## Development

```sh
pnpm install
pnpm check
pnpm test
pnpm build
```
