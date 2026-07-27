# Tightspace

A small, dependency-free blog for [tightspace.xyz](https://tightspace.xyz), published with GitHub Pages.

## Develop locally

```sh
npm run dev
```

Open `http://localhost:4173`. Run the complete automated check suite with:

```sh
npm run check
```

With Chrome or Chromium installed, run the reusable real-browser smoke suite with:

```sh
npm run test:browser
```

It produces ignored visual snapshots in `test-artifacts/` while checking desktop, mobile, theme, search, keyboard, storage-failure, routing, and short-viewport behavior.

## Publish with GitHub Pages

1. Push the repository's `main` branch.
2. In **Repository settings → Pages**, choose **Deploy from a branch**, then select `main` and `/(root)`.
3. Verify `tightspace.xyz` in the GitHub account's Pages settings before changing DNS.
4. In the repository's Pages settings, set the custom domain to `tightspace.xyz`.
5. At the DNS provider, replace parking records with these GitHub Pages records:

   | Type | Host | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `jasurme.github.io` |

6. After DNS and certificate provisioning finish, enable **Enforce HTTPS**.

Keep the root `CNAME` file. Avoid wildcard DNS records and remove conflicting apex or `www` records. DNS and HTTPS provisioning can take up to 24 hours.

Current official references:

- [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Verifying a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [Securing a Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

## Add a post

Create `posts/<slug>/index.html`, copy the semantic article shell from the existing post, and add one entry to `SITE_ITEMS` in `assets/core.js`. Then add its card to `posts/index.html` and run `npm run check`.
