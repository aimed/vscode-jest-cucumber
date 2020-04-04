# VSCode jest-cucumber

Adds `Define Features` to VSCode.
Given a spec file similar to the one listed below the command will auto insert all tests needed for the feature file.

```ts
// feature.spec.ts
import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('./rocket.feature');
```
