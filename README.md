# www.ryanp.me

This repository contains the source and build/deployment scripts for my personal
website.

## Getting Started

This project uses Gulp to build and deploy the site, so to get started, you'll
need to install the global gulp-cli wrapper and this project's dependencies.

```bash
yarn global add gulp-cli
yarn install
```

Once you've installed the project dependencies and the gulp-cli wrapper, you can
run any of the Gulp tasks defined in `gulpfile.js`. For example, to prepare the
site for CDN deployment, you can run:

```bash
gulp dist
# do something with the resulting files in .ci/dist
```

You can look in the `gulpfile.js` for a full understanding of what tasks are
available and what they do, but to summarize:

`gulp minify`:

* autoprefixes all CSS files for better browser compatibility
* minifies all CSS and HTML files
* writes the prefixed and minified files to an intermediate build directory
* copies all static assets to an intermediate build directory

`gulp dist`:
* cleans the `build` and `dist` directories
* runs the `minify` task
* performs static asset revisioning on the `build` directory (allows serving
  static files with lifetime expiration dates, which improves browser and CDN
  cache hits), and writes the revisioned files to the `dist` directory

`gulp publish`:
* runs the `dist` task
* synchronizes the `dist` directory with an S3 bucket
