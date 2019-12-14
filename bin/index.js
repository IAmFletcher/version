#!/usr/bin/env node

/* eslint-disable no-use-before-define */

const { readFile, writeFile } = require('fs');
const { prompt } = require('inquirer');
const git = require('simple-git/promise')();

const PACKAGE_JSON_PATH = './package.json';
const SEMVER_REGEX = /^(?<major>\d+).(?<minor>\d+).(?<patch>\d+)(?<extra>.+|)/u;
const QUESTIONS = [
  {
    type: 'list',
    name: 'version',
    message: 'Version',
    choices: [
      {
        name: 'Major',
        value: 'major',
      },
      {
        name: 'Minor',
        value: 'minor',
      },
      {
        name: 'Patch',
        value: 'patch',
      },
    ],
  },
];

let packageJSON = null;

readPackageJSON()
  .then((data) => {
    packageJSON = JSON.parse(data);

    if (!packageJSON) {
      throw new Error(`packageJSON is ${typeof packageJSON}`);
    }

    return prompt(QUESTIONS);
  })
  .then(({ version }) => {
    return {
      version,
      semver: getSemVer(),
    };
  })
  .then(({ version, semver }) => {
    bumpVersion(version, semver);

    return git.checkIsRepo();
  })
  .then((isRepo) => {
    if (!isRepo) {
      throw new Error('You need to initialise a git repo first');
    }

    return writePackageJSON();
  })
  .then(() => {
    commitPackageJSON();
  })
  .then(() => {
    console.log(`Successfully bumped version to ${packageJSON.version}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });

function readPackageJSON () {
  return new Promise((resolve, reject) => {
    readFile(PACKAGE_JSON_PATH, 'utf8', (err, data) => {
      if (err) {
        return reject(err);
      }

      return resolve(data);
    });
  });
}

function getSemVer () {
  const match = packageJSON.version.match(SEMVER_REGEX);

  if (!match) {
    throw new Error('version isn\'t valid SemVer. Examples: 12.2.1, 0.1.3-alpha');
  }

  return {
    major: parseInt(match.groups.major, 10),
    minor: parseInt(match.groups.minor, 10),
    patch: parseInt(match.groups.patch, 10),
    extra: match.groups.extra,
  };
}

function bumpVersion (version, { major, minor, patch, extra }) {
  switch (version) {
  case 'major':
    packageJSON.version = `${major + 1}.0.0${extra}`;
    break;
  case 'minor':
    packageJSON.version = `${major}.${minor + 1}.0${extra}`;
    break;
  case 'patch':
    packageJSON.version = `${major}.${minor}.${patch + 1}${extra}`;
    break;
  default:
  }
}

function writePackageJSON () {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(packageJSON, null, 2);

    writeFile(PACKAGE_JSON_PATH, data, (err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
}

function commitPackageJSON () {
  return git.add(PACKAGE_JSON_PATH)
    .then(() => {
      git.commit(`Bump version to v${packageJSON.version}`);
    });
}
