const DEFAULT_REPO = "my-codex";
const DEFAULT_BRANCH = "main";
const DEFAULT_PROFILE = "default";
const PROFILE_EXTENSION = ".age";
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ProfileReference {
  owner: string;
  profile: string;
  repo: string;
  branch: string;
  filePath: string;
  rawUrl: string;
}

function assertSegment(segment: string, label: string): string {
  if (!SEGMENT_PATTERN.test(segment)) {
    throw new Error(
      `${label} must use only letters, numbers, dot, underscore, or hyphen.`,
    );
  }

  return segment;
}

export function parseProfileReference(input: string): ProfileReference {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Profile reference cannot be empty.");
  }

  const [ownerPart, profilePart, ...rest] = trimmed.split("/");
  if (rest.length > 0) {
    throw new Error(
      "Profile reference must look like <owner> or <owner>/<profile>.",
    );
  }

  const owner = assertSegment(ownerPart ?? "", "owner");
  const profile = assertSegment(profilePart ?? DEFAULT_PROFILE, "profile");
  const filePath = `profiles/${profile}${PROFILE_EXTENSION}`;

  return {
    owner,
    profile,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
    filePath,
    rawUrl: `https://raw.githubusercontent.com/${owner}/${DEFAULT_REPO}/${DEFAULT_BRANCH}/${filePath}`,
  };
}

export function formatProfileReference(reference: ProfileReference): string {
  if (reference.profile === DEFAULT_PROFILE) {
    return reference.owner;
  }

  return `${reference.owner}/${reference.profile}`;
}
