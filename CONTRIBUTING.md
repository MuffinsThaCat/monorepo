### Publishing to npm

Before publishing any package to `npm` perform the following steps:

1. Run `yarn` to ensure the lockfile is up to date
2. Run `yarn test:unit` to ensure all unit tests are passing
3. Run `yarn clean` to remove any old build artifacts (prevents accidentally publishing old code)
4. Run `yarn build` to build all the packages
5. Ensure that your package has a sensible `.npmignore`
6. Ensure that the `main` and `types` keys in your package are set correctly
7. Bump the version number in `package.json` (https://semver.org/, ask the team if you're unsure)
8. Commit the above changes to a branch
9. Create a PR and get approval
10. Merge the PR to main
11. **Pull and checkout _latest_ main** and tag the commit (`git tag -s <package-to-release>@<new-package-version> <commit>`)
12. Push tags (`git push --tags`)
13. From the tagged commit, ensure your working tree is clean with `git status`
14. Publish to npm (run this from the package you want to publish `yarn npm publish --access public`)
