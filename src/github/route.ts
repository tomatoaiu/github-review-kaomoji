const pullRequestPath = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/u

export function isPullRequestRoute(url: URL): boolean {
  return url.hostname === "github.com" && pullRequestPath.test(url.pathname)
}
