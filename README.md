# VSCode jest-cucumber

Adds `Define Features` to VSCode.
Given a spec file similar to the one listed below the command will auto insert all tests needed for the feature file.

```feature
// rocket.feature
Feature: Rocket Launching

    Scenario: Launching a SpaceX rocket
        Given I am Elon Musk attempting to launch a rocket into space
        When I launch the rocket
        Then the rocket should end up in space
        And the booster(s) should land back on the launch pad
        And nobody should doubt me ever again

    Scenario Outline: Selling an item
        Given I have a(n) <Item>
        When I sell the <Item>
        Then I should get $<Amount>

        Examples:

            | Item                                           | Amount |
            | Autographed Neil deGrasse Tyson book           | 100    |
            | Rick Astley t-shirt                            | 22     |
            | An idea to replace EVERYTHING with blockchains | $0     |
```

```ts
// rocket.spec.ts
import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('./rocket.feature');

// ⬇️ This will be generated
defineFeature(feature, test => {
    test('Launching a SpaceX rocket', ({ given, when, then }) => {
        given('I am Elon Musk attempting to launch a rocket into space', async () => { })

        when('I launch the rocket', async () => { })

        then('the rocket should end up in space', async () => { })

        then('the booster(s) should land back on the launch pad', async () => { })

        then('nobody should doubt me ever again', async () => { })
    })


    test('Selling an item', ({ given, when, then }) => {
        given(/^I have a\(n\) (.*)$/, async (varItem: string) => { })

        when(/^I sell the (.*)$/, async (varItem: string) => { })

        then(/^I should get \$(.*)$/, async (varAmount: string) => { })
    })
})
```
