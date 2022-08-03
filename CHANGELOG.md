# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0](https://github.com/unjs/unctx/compare/v1.1.4...v2.0.0) (2022-08-03)


### ⚠ BREAKING CHANGES

* strict `ctx.use` and new `ctx.tryUse` (#7)

### Features

* strict `ctx.use` and new `ctx.tryUse` ([#7](https://github.com/unjs/unctx/issues/7)) ([b54dbd3](https://github.com/unjs/unctx/commit/b54dbd3134806556b1e94c9b4c27f19b2df5a7df))

### [1.1.4](https://github.com/unjs/unctx/compare/v1.1.3...v1.1.4) (2022-03-31)

### [1.1.3](https://github.com/unjs/unctx/compare/v1.1.2...v1.1.3) (2022-03-25)


### Bug Fixes

* **plugin:** generate map correctly ([d9350b7](https://github.com/unjs/unctx/commit/d9350b7421f15697945f2e68ecbd0e1da7e7abef))
* **plugin:** webpack compatible ([b4572a4](https://github.com/unjs/unctx/commit/b4572a4ecb2ace00aead2a224fcc391a52efa4bb))
* **transform:** allow overriding `createTransformer` ([7ef74ff](https://github.com/unjs/unctx/commit/7ef74ff06ac511dc44075f3fdcb3a47f566fa640))
* **transform:** disable transforming `callAsync` by default ([#5](https://github.com/unjs/unctx/issues/5)) ([dc0fcfd](https://github.com/unjs/unctx/commit/dc0fcfdc21ca4b218f1924eb2408687ee6690477))

### [1.1.2](https://github.com/unjs/unctx/compare/v1.1.1...v1.1.2) (2022-03-24)


### Bug Fixes

* types resolution order ([4db084a](https://github.com/unjs/unctx/commit/4db084adbe83216e23908786a3c6f7974bd321e1))

### [1.1.1](https://github.com/unjs/unctx/compare/v1.1.0...v1.1.1) (2022-03-24)


### Bug Fixes

* submodule types ([4dfd0cd](https://github.com/unjs/unctx/commit/4dfd0cdd59c153ffd080b83c6922c2feec9e8dd6))

## [1.1.0](https://github.com/unjs/unctx/compare/v1.0.2...v1.1.0) (2022-03-22)


### Features

* transfromer for async context support ([#4](https://github.com/unjs/unctx/issues/4)) ([bc4d17a](https://github.com/unjs/unctx/commit/bc4d17a753181bfa18697553eb96d390715cf6e2))

### [1.0.2](https://github.com/unjs/unctx/compare/v1.0.1...v1.0.2) (2021-08-24)


### Bug Fixes

* **call:** don't set instance to null when using singleton ([248dc32](https://github.com/unjs/unctx/commit/248dc3218e70238a6091cf5707bafbeb2d1fd91f)), closes [nuxt/framework#51](https://github.com/nuxt/framework/issues/51)

### [1.0.1](https://github.com/unjs/unctx/compare/v1.0.0...v1.0.1) (2021-06-24)

## [1.0.0](https://github.com/unjs/unctx/compare/v0.0.4...v1.0.0) (2021-06-24)

### [0.0.4](https://github.com/unjs/unctx/compare/v0.0.3...v0.0.4) (2021-06-24)


### Features

* singleton pattern support ([f506172](https://github.com/unjs/unctx/commit/f5061726e89771605ba8f7663ec89e3f0c914033))


### Bug Fixes

* unset context if callback throws  immediate error ([f045049](https://github.com/unjs/unctx/commit/f04504953630edf840e7389f0838b63674ac2f34))

### [0.0.3](https://github.com/unjs/unctx/compare/v0.0.2...v0.0.3) (2021-03-30)


### Bug Fixes

* add missing return to createNamespace ([04886ef](https://github.com/unjs/unctx/commit/04886efb014f2715de924b936fd7b6b210454531))

### [0.0.2](https://github.com/unjs/unctx/compare/v0.0.1...v0.0.2) (2021-03-30)


### Features

* simplify useContext ([4a740bc](https://github.com/unjs/unctx/commit/4a740bc9c7c6013569859018ef5d622acbb6b55a))

### 0.0.1 (2021-03-30)


### Features

* initial commit ([80fe123](https://github.com/unjs/unctx/commit/80fe123c7ba597ca827be830fc7f021ad28d94da))
