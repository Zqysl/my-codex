# my-codex

`my-codex` is a lightweight tool that lets you activate your custom Codex anywhere, on any server, at any time.

The intended one-line UX is:

```sh
npx -y my-codex use <your-github-name>
```

`my-codex` reads the Codex configuration stored in your GitHub fork and automatically opens a temporary shell with your Codex session configured.

## Quick Start

Fork this repository.
[github.com/Zqysl/my-codex/fork](https://github.com/Zqysl/my-codex/fork)

Clone the frok project.

Generate an encrypted profile from your local Codex installation
```sh
pnpm install
pnpm dev -- encrypt
```

Push your profile to fork project

Now use `my-codex` from any machine.
```sh
npx -y my-codex use <your-github-name>
```


## How It Works

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
- `--yes`: skip confirmation prompts

### `use`

`use` opens a temporary child shell with your profile activated.

It previews the profile source before passphrase entry, then previews the decrypted configuration before activation.

### `exec`

`exec` runs one command with your profile activated, without opening an interactive shell.

### Automation

For non-interactive usage, skip confirmation prompts with:

```sh
MY_CODEX_ASSUME_YES=1
```

or:

```sh
my-codex use <owner> --yes
```

### `doctor`

`doctor` prints local runtime details such as the `codex` path and current shell.

## Shared vs Isolated

- `shared`: reuse the existing `~/.codex` on the target machine
- `isolated`: allocate a temporary `CODEX_HOME` for the activated shell

Use `shared` if you only want to switch runtime settings such as:

- `OPENAI_API_KEY`
- `base_url`
- `model_provider`
- `model`

Use `isolated` if you also want temporary state separation.


## Development

```sh
pnpm install
pnpm check
pnpm test
pnpm build
```
