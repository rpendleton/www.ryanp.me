'use strict';
require('process').chdir('..');

//! NPM modules, gulp and plugins

const gulp = require('gulp');
const $ = require('gulp-load-plugins')({
    pattern: [
        'gulp-*',
        'del',
    ],
    rename: {
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
    return gulp.src('css/**/*.css', )
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
    return gulp.src('*.html')
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
        '**',
        '!css/**/*.css',
        '!*.html',
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
    const publisher = $.awspublish.create({
        region: 'us-west-2',
        params: {
            Bucket: 'personal.ryanp.me'
        }
    });

    return gulp.src('**', { cwd: '.ci/dist' })
        .pipe($.rename(path => {
            path.dirname = 'www.ryanp.me/' + path.dirname;
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
        .pipe(publisher.publish())
        .pipe(publisher.cache())
        .pipe(publisher.sync("www.ryanp.me"))
        .pipe($.awspublish.reporter());
});

gulp.task('publish', gulp.series('dist', 'publish:s3'));
