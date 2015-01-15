// gulp
var gulp = require('gulp');

// plugins
var jshint      = require('gulp-jshint');
var browserify  = require('gulp-browserify');

// tasks
gulp.task('lint', function() {
  gulp.src(['./public/js/src/**/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('browserify', function() {
  gulp.src(['./public/js/src/pong.js'])
  .pipe(browserify({
    insertGlobals: true,
    debug: true
  }))
  .pipe(gulp.dest('./public/js'));
});

gulp.task('dev', ['bundle'], function() {
  gulp.watch('./public/js/src/**/*.js', ['bundle']);
});

// default task
gulp.task('bundle',
  ['lint', 'browserify']
);

