'use strict';

//! load any environment variables specified in .env
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

//! NPM modules, gulp and plugins

const gulp = require('gulp');
const $ = require('gulp-load-plugins')({
    pattern: [
        'gulp-*',
        'concurrent-transform',
        'del',
    ],
    rename: {
        'concurrent-transform': 'concurrent',
    }
});

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const onError = $.notify.onError("Error: <%= error.message %>");

//! Cleaning

gulp.task('clean:build', () => {
    return $.del('.ci/build');
});

gulp.task('clean:dist', () => {
    return $.del('.ci/dist');
});

gulp.task('clean', gulp.parallel('clean:build', 'clean:dist'));

//! Minification

gulp.task('minify:css', () => {
    return gulp.src('src/css/**/*.css', )
        .pipe($.plumber(onError))
        .pipe($.sourcemaps.init())
        .pipe($.postcss([
            autoprefixer(),
            cssnano(),
        ]))
        .pipe($.sourcemaps.write('.'))
        .pipe(gulp.dest('.ci/build/css'));
});

gulp.task('minify:html', () => {
    return gulp.src('src/*.html')
        .pipe($.plumber(onError))
        .pipe($.htmlmin({
            collapseWhitespace: true,
            conservativeCollapse: true,
            removeComments: true,
            sortAttributes: true,
            sortClassName: true,
        }))
        .pipe(gulp.dest('.ci/build'));
});

gulp.task('minify:static', () => {
    const assets = gulp.src([
        'src/**',
        '!src/css/**/*.css',
        '!src/*.html',
    ]);

    return assets.pipe(gulp.dest('.ci/build'));
});

gulp.task('minify', gulp.parallel('minify:css', 'minify:html', 'minify:static'));

//! Deployment

gulp.task('dist:cdn', () => {
    var path = require('path');

    return gulp.src('.ci/build/**')
        .pipe($.revAll.revision({
            dontRenameFile: [
                /^\/robots.txt$/g,
                /^\/index.html$/g,
            ],
            hashLength: 4,
            transformFilename: (file, hash) => {
                const ext = path.extname(file.path);
                const basename = path.basename(file.path, ext);
                return basename + '.rev.' + hash.substr(0, 4) + ext;
            },
        }))
        .pipe(gulp.dest('.ci/dist'))
});

gulp.task('dist', gulp.series('clean', 'minify', 'dist:cdn'));

gulp.task('publish:s3', () => {
    const bucket = determinePublishBucket();
    const prefix = determinePublishPrefix();

    const publisher = $.awspublish.create(
        {
            region: 'us-west-2',
            params: {
                Bucket: bucket
            }
        },
        {
            cacheFileName: `.ci/awspublish-${bucket}.json`,
        }
    );

    return gulp.src('**', { cwd: '.ci/dist' })
        .pipe($.rename(path => {
            path.dirname = prefix + path.dirname;
        }))
        .pipe($.awspublishRouter({
            routes: {
                '\\.rev\\.([a-z0-9]{4})': {
                    cacheTime: 604800, // 1 week
                },

                '\\wrobots\\.txt$': {
                    cacheTime: 300 // 5 minutes
                },

                '^.+$': {}
            }
        }))
        .pipe($.concurrent(publisher.publish(), 4))
        .pipe(publisher.cache())
        .pipe(publisher.sync(prefix))
        .pipe($.awspublish.reporter());

    function determinePublishBucket() {
        const bucket = process.env['S3_PUBLISH_BUCKET'];
        if (!bucket) {
            throw 'Missing S3_PUBLISH_BUCKET.';
        }

        return bucket;
    }

    function determinePublishPrefix() {
        const prefix = process.env['S3_PUBLISH_PREFIX'];
        if (!prefix) {
            throw "Missing S3_PUBLISH_PREFIX. If you really want to publish to the root of a bucket, specify '/'.";
        }

        if (prefix.endsWith('/')) {
            return prefix;
        }
        else {
            return prefix + '/';
        }
    }
});

gulp.task('publish', gulp.series('dist', 'publish:s3'));
