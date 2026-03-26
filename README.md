# my-codex

`my-codex` is a small TypeScript CLI that lets someone activate their own Codex configuration from an encrypted profile stored in a public GitHub repository.

The main UX is intentionally short:

```sh
npx -y my-codex use zqysl
```

That command downloads `https://raw.githubusercontent.com/zqysl/my-codex/main/profiles/default.mcx.json`, prompts for a passphrase, creates a temporary wrapper around `codex`, and opens a child shell where your Codex config is active only for that shell session.

## Commands

```sh
npx -y my-codex use <owner>
npx -y my-codex use <owner>/<profile>
npx -y my-codex exec <owner> -- codex login status
npx -y my-codex encrypt ./default.json
npx -y my-codex doctor
```

- `use`: opens a temporary shell with the profile activated
- `exec`: runs one command in an activated environment
- `encrypt`: turns a plaintext profile JSON file into a `.mcx.json` encrypted envelope
- `doctor`: prints runtime details such as `codex` path and current shell

## Profile Layout

Remote profiles are resolved by convention:

- owner only: `zqysl` -> `zqysl/my-codex` repo -> `profiles/default.mcx.json`
- owner/profile: `zqysl/work` -> `zqysl/my-codex` repo -> `profiles/work.mcx.json`

Plaintext profile example:

```json
{
  "version": 1,
  "name": "default",
  "mode": "shared",
  "env": {
    "OPENAI_API_KEY": "sk-example"
  },
  "overrides": {
    "model_provider": "demo",
    "model": "gpt-5.4"
  },
  "providers": {
    "demo": {
      "name": "demo",
      "baseUrl": "https://example.com",
      "wireApi": "responses"
    }
  }
}
```

`mode` supports:

- `shared`: reuse the current `~/.codex`
- `isolated`: allocate a temporary `CODEX_HOME`

## Create Your Own Profile Repo

1. Create a public GitHub repo named `my-codex`.
2. Add a plaintext profile file, for example `default.json`.
3. Encrypt it:

```sh
MY_CODEX_PASSPHRASE='your-passphrase' npx -y my-codex encrypt ./default.json
```

4. Commit the generated `default.mcx.json` to `profiles/default.mcx.json`.

Minimal layout:

```text
my-codex/
  profiles/
    default.mcx.json
    work.mcx.json
```

## Security Model

- The GitHub repository stores only encrypted profile envelopes.
- Decryption uses a passphrase with `scrypt` + `aes-256-gcm`.
- The passphrase is read from `MY_CODEX_PASSPHRASE` or prompted interactively.
- `use` does not modify the parent shell. It starts a temporary child shell instead.
- In `shared` mode, the existing `~/.codex` is still reused.
- In `isolated` mode, `my-codex` sets a temporary `CODEX_HOME`.

## Development

```sh
pnpm install
pnpm check
pnpm test
pnpm build
```
