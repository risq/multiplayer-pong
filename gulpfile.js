var gulp = require('gulp');

var jshint = require('gulp-jshint'),
    browserify = require('gulp-browserify'),
    del = require('del'),
    runSequence = require('run-sequence');

function handleError(err) {
    console.log('[ERROR] ' + err.message || err);
}

gulp.task('lint', function() {
    gulp.src(['./src/**/*.js', './app.js'])
        .pipe(jshint())
        .on('error', handleError);
});

gulp.task('lintServer', function() {
    gulp.src(['./public/js/src/**/*.js'])
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('browserify:dev', function() {
    gulp.src(['./public/js/src/pong.js'])
        .pipe(browserify({
            insertGlobals: true,
            debug: true
        }))
        .on('error', handleError)
        .pipe(gulp.dest('./public/js'));
});

gulp.task('browserify:build', function() {
    gulp.src(['./public/js/src/pong.js'])
        .pipe(browserify({
            insertGlobals: true
        }))
        .pipe(gulp.dest('./dist/js'));
});

gulp.task('bundle:dev', ['lint', 'browserify:dev']);

gulp.task('bundle:build', ['lint', 'lintServer', 'browserify:build']);

gulp.task('clean', function (cb) {
  del(['dist/'], cb);
});

gulp.task('copy', function() {
    gulp.src(['./public/**/*.*', '!./public/js/**/*.*'], {base: './public'})
        .pipe(gulp.dest('./dist'));
});


gulp.task('build', function() {
    runSequence('clean', ['bundle:build', 'copy']);
});

gulp.task('watch', ['bundle:dev'], function() {
    gulp.watch('./public/js/src/**/*.js', ['bundle:dev']);
});