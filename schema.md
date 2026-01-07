---
title: Models
description: Strapi models (i.e. content-types, components, and dynamic zones) define a representation of the content structure.
toc_max_heading_level: 4
tags:
- admin panel
- backend customization
- backend server
- content-type
- Content-type Builder
- models
- model schema
- lifecycle hooks
- REST API 
---

# Models

The content-types use the following files:

- `schema.json` for the model's [schema](#model-schema) definition. (generated automatically, when creating content-type with either method)
- `lifecycles.js` for [lifecycle hooks](#lifecycle-hooks). This file must be created manually.

These models files are stored in `./src/api/[api-name]/content-types/[content-type-name]/`, and any JavaScript or JSON file found in these folders will be loaded as a content-type's model (see [project structure](/cms/project-structure)).

:::note
In [TypeScript](/cms/typescript.md)-enabled projects, schema typings can be generated using the `ts:generate-types` command.
:::

### Components {#components-creation}

Component models can't be created with CLI tools. Use the [Content-type Builder](/cms/features/content-type-builder) or create them manually.

Components models are stored in the `./src/components` folder. Every component has to be inside a subfolder, named after the category the component belongs to (see [project structure](/cms/project-structure)).

## Model schema

The `schema.json` file of a model consists of:

- [settings](#model-settings), such as the kind of content-type the model represents or the table name in which the data should be stored,
- [information](#model-information), mostly used to display the model in the admin panel and access it through the REST and GraphQL APIs,
- [attributes](#model-attributes), which describe the content structure of the model,
- and [options](#model-options) used to defined specific behaviors on the model.

### Model settings

General settings for the model can be configured with the following parameters:

| Parameter                                          | Type   | Description                                                                                                            |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `collectionName`                                  | String | Database table name in which the data should be stored                                                    |
| `kind`<br /><br />_Optional,<br/>only for content-types_ | String | Defines if the content-type is:<ul><li>a collection type (`collectionType`)</li><li>or a single type (`singleType`)</li></ul> |

```json
// ./src/api/[api-name]/content-types/restaurant/schema.json

{
  "kind": "collectionType",
  "collectionName": "Restaurants_v1",
}
```

### Model information

The `info` key in the model's schema describes information used to display the model in the admin panel and access it through the Content API. It includes the following parameters:

<!-- ? with the new design system, do we still use FontAwesome?  -->

| Parameter            | Type   | Description                                                                                                                                 |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `displayName`  | String | Default name to use in the admin panel                                                                                                      |
| `singularName` | String | Singular form of the content-type name.<br />Used to generate the API routes and databases/tables collection.<br /><br />Should be kebab-case. |
| `pluralName`   | String | Plural form of the content-type name.<br />Used to generate the API routes and databases/tables collection.<br /><br />Should be kebab-case.    |
| `description`  | String | Description of the model                                                                                                                   |

```json title="./src/api/[api-name]/content-types/restaurant/schema.json"

  "info": {
    "displayName": "Restaurant",
    "singularName": "restaurant",
    "pluralName": "restaurants",
    "description": ""
  },
```

### Model attributes

The content structure of a model consists of a list of attributes. Each attribute has a `type` parameter, which describes its nature and defines the attribute as a simple piece of data or a more complex structure used by Strapi.

Many types of attributes are available:

- scalar types (e.g. strings, dates, numbers, booleans, etc.),
- Strapi-specific types, such as:
  - `media` for files uploaded through the [Media library](/cms/features/content-type-builder#media)
  - `relation` to describe a [relation](#relations) between content-types
  - `customField` to describe [custom fields](#custom-fields) and their specific keys
  - `component` to define a [component](#components-json) (i.e. a content structure usable in multiple content-types)
  - `dynamiczone` to define a [dynamic zone](#dynamic-zones) (i.e. a flexible space based on a list of components)
  - and the `locale` and `localizations` types, only used by the [Internationalization (i18n) plugin](/cms/features/internationalization)

The `type` parameter of an attribute should be one of the following values:

| Type categories | Available types |
|------|-------|
| String types | <ul><li>`string`</li> <li>`text`</li> <li>`richtext`</li><li>`enumeration`</li> <li>`email`</li><li>`password`</li><li>[`uid`](#uid-type)</li></ul> |
| Date types | <ul><li>`date`</li> <li>`time`</li> <li>`datetime`</li> <li>`timestamp`</li></ul> |
| Number types | <ul><li>`integer`</li><li>`biginteger`</li><li>`float`</li> <li>`decimal`</li></ul> |
| Other generic types |<ul><li>`boolean`</li><li>`json`</li></ul> |
| Special types unique to Strapi |<ul><li>`media`</li><li>[`relation`](#relations)</li><li>[`customField`](#custom-fields)</li><li>[`component`](#components-json)</li><li>[`dynamiczone`](#dynamic-zones)</li></ul> |
| Internationalization (i18n)-related types<br /><br />_Can only be used if the [i18n](/cms/features/internationalization) is enabled on the content-type_|<ul><li>`locale`</li><li>`localizations`</li></ul> |

#### Validations

Basic validations can be applied to attributes using the following parameters:

| Parameter | Type    | Description                                                                                               | Default |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------- | ------- |
| `required`     | Boolean | If `true`, adds a required validator for this property                                                     | `false` |
| `max`          | Integer | Checks if the value is greater than or equal to the given maximum                                        | -       |
| `min`          | Integer | Checks if the value is less than or equal to the given minimum                                           | -       |
| `minLength`    | Integer | Minimum number of characters for a field input value                                                      | -       |
| `maxLength`    | Integer | Maximum number of characters for a field input value                                                      | -       |
| `private`      | Boolean | If `true`, the attribute will be removed from the server response.<br/><br/>💡 This is useful to hide sensitive data. | `false` |
| `configurable` | Boolean | If `false`, the attribute isn't configurable from the Content-type Builder plugin.                         | `true`  |

```json title="./src/api/[api-name]/content-types/restaurant/schema.json"

{
  // ...
  "attributes": {
    "title": {
      "type": "string",
      "minLength": 3,
      "maxLength": 99,
      "unique": true
    },
    "description": {
      "default": "My description",
      "type": "text",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    }
    // ...
  }
}
```

#### Database validations and settings

:::caution 🚧 This API is considered experimental.
These settings should be reserved to an advanced usage, as they might break some features. There are no plans to make these settings stable.
:::

Database validations and settings are custom options passed directly onto the `tableBuilder` Knex.js function during schema migrations. Database validations allow for an advanced degree of control for setting custom column settings. The following options are set in a `column: {}` object per attribute:

| Parameter     | Type    | Description                                                                                   | Default |
| ------------- | ------- | --------------------------------------------------------------------------------------------- | ------- |
| `name`        | string  | Changes the name of the column in the database                                                | -       |
| `defaultTo`   | string  | Sets the database `defaultTo`, typically used with `notNullable`                              | -       |
| `notNullable` | boolean | Sets the database `notNullable`, ensures that columns cannot be null                          | `false` |
| `unsigned`    | boolean | Only applies to number columns, removes the ability to go negative but doubles maximum length | `false` |
| `unique`      | boolean | Enforces database-level uniqueness on published entries. Draft saves skip the check when Draft & Publish is enabled, so duplicates fail only at publish time. | `false` |
| `type`        | string  | Changes the database type, if `type` has arguments, you should pass them in `args`            | -       |
| `args`        | array   | Arguments passed into the Knex.js function that changes things like `type`                    | `[]`    |

:::caution Draft & Publish and `unique`
When [Draft & Publish](/cms/features/draft-and-publish) is enabled, Strapi intentionally skips `unique` validations while an entry is saved as a draft. Duplicates therefore remain undetected until publication, at which point the database constraint triggers an error even though the UI previously displayed “Saved document” for the drafts.

To avoid unexpected publication failures:

- disable Draft & Publish on content-types that must stay globally unique,
- or add custom validation (e.g. lifecycle hooks or middleware) that checks for draft duplicates before saving,
- or rely on automatically generated unique identifiers such as a `uid` field and document editorial conventions.
:::

```json title="./src/api/[api-name]/content-types/restaurant/schema.json"

{
  // ...
  "attributes": {
    "title": {
      "type": "string",
      "minLength": 3,
      "maxLength": 99,
      "unique": true,
      "column": {
        "unique": true // enforce database unique also
      }
    },
    "description": {
      "default": "My description",
      "type": "text",
      "required": true,
      "column": {
        "defaultTo": "My description", // set database level default
        "notNullable": true // enforce required at database level, even for drafts
      }
    },
    "rating": {
      "type": "decimal",
      "default": 0,
      "column": {
        "defaultTo": 0,
        "type": "decimal", // using the native decimal type but allowing for custom precision
        "args": [
          6,1 // using custom precision and scale
        ]
      }
    }
    // ...
  }
}
```

#### `uid` type

The `uid` type is used to automatically prefill the field value in the admin panel with a unique identifier (UID) (e.g. slugs for articles) based on 2 optional parameters:

- `targetField` (string): If used, the value of the field defined as a target is used to auto-generate the UID.
- `options` (string): If used, the UID is generated based on a set of options passed to <ExternalLink to="https://github.com/sindresorhus/slugify" text="the underlying `uid` generator"/>. The resulting `uid` must match the following regular expression pattern: `/^[A-Za-z0-9-_.~]*$`.

#### Relations

Relations link content-types together. Strapi supports both single-entry relations (one-way and one-to-one) and multi relations where at least one side can point to several entries (one-to-many, many-to-one, many-to-many, and many-way). Multi relations are persisted as arrays in the database layer and are returned as arrays in the Content API responses.

Relations are explicitly defined in the [attributes](#model-attributes) of a model with `type: 'relation'` and accept the following additional parameters:

| Parameter                         | Description                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `relation`                  | The type of relation among these values:<ul><li>`oneToOne`</li><li>`oneToMany`</li><li>`manyToOne`</li><li>`manyToMany`</li></ul>                   |
| `target`                    | Accepts a string value as the name of the target content-type                                                                                   |
| `mappedBy` and `inversedBy`<br /><br />_Optional_ | In bidirectional relations, the owning side declares the `inversedBy` key while the inversed side declares the `mappedBy` key |

<Tabs>

<TabItem value="one-to-one" label="One-to-one">

One-to-One relationships are useful when one entry can be linked to only one other entry.

They can be unidirectional or bidirectional. In unidirectional relationships, only one of the models can be queried with its linked item.

<details>
<summary>Unidirectional use case example:</summary>

  - A blog article belongs to a category.
  - Querying an article can retrieve its category,
  - but querying a category won't retrieve the owned article.

  ```json title="./src/api/[api-name]/content-types/article/schema.json"

    // …
    attributes: {
      category: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'category',
      },
    },
    // …
  ```

</details>

<details>
<summary>Bidirectional use case example:</summary>

  - A blog article belongs to a category.
  - Querying an article can retrieve its category,
  - and querying a category also retrieves its owned article.

  ```json title="./src/api/[api-name]/content-types/article/schema.json"

    // …
    attributes: {
      category: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'category',
        inversedBy: 'article',
      },
    },
    // …

  ```

  ```json title="./src/api/[api-name]/content-types/category/schema.json"

    // …
    attributes: {
      article: {
        type: 'relation',
        relation: 'oneToOne',
        target: 'article',
        mappedBy: 'category',
      },
    },
    // …

  ```

</details>

</TabItem>

<TabItem value="one-to-many" label="One-to-Many">

One-to-Many relationships are useful when:

- an entry from a content-type A is linked to many entries of another content-type B,
- while an entry from content-type B is linked to only one entry of content-type A.

One-to-many relationships are always bidirectional, and are usually defined with the corresponding Many-to-One relationship:

<details>
<summary>Example:</summary>
A person can own many plants, but a plant is owned by only one person.

```json title="./src/api/[api-name]/content-types/plant/schema.json"

  // …
  attributes: {
    owner: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::person.person',
      inversedBy: 'plants',
    },
  },
  // …

```

```json title="./src/api/person/models/schema.json"

  // …
  attributes: {
    plants: {
      type: 'relation',
      relation: 'oneToMany',
      target: 'api::plant.plant',
      mappedBy: 'owner',
    },
  },
  // …
```

</details>

</TabItem>

<TabItem value="many-to-one" label="Many-to-One">

Many-to-One relationships are useful to link many entries to one entry.

They can be unidirectional or bidirectional. In unidirectional relationships, only one of the models can be queried with its linked item.

<details>
<summary>Unidirectional use case example:</summary>

  A book can be written by many authors.

  ```json title="./src/api/[api-name]/content-types/book/schema.json"

    // …
    attributes: {
      author: {
        type: 'relation',
        relation: 'manyToOne',
        target: 'author',
      },
    },
    // …

  ```

</details>

<details>
<summary>Bidirectional use case example:</summary>

  An article belongs to only one category but a category has many articles.

  ```json title="./src/api/[api-name]/content-types/article/schema.json"

    // …
    attributes: {
      author: {
        type: 'relation',
        relation: 'manyToOne',
        target: 'category',
        inversedBy: 'article',
      },
    },
    // …
  ```

  ```json title="./src/api/[api-name]/content-types/category/schema.json"

    // …
    attributes: {
      books: {
        type: 'relation',
        relation: 'oneToMany',
        target: 'article',
        mappedBy: 'category',
      },
    },
    // …
  ```

</details>

</TabItem>

<TabItem value="many-to-many" label="Many-to-Many">

Many-to-Many relationships are useful when:

- an entry from content-type A is linked to many entries of content-type B,
- and an entry from content-type B is also linked to many entries from content-type A.

Many-to-many relationships can be unidirectional or bidirectional. In unidirectional relationships, only one of the models can be queried with its linked item.

<details>
<summary>Unidirectional use case example:</summary>

  ```json
    // …
    attributes: {
      categories: {
        type: 'relation',
        relation: 'manyToMany',
        target: 'category',
      },
    },
    // …
  ```

</details>

<details>
<summary>Bidirectional use case example:</summary>

An article can have many tags and a tag can be assigned to many articles.

  ```json title="/src/api/[api-name]/content-types/article/schema.json"

    // …
    attributes: {
      tags: {
        type: 'relation',
        relation: 'manyToMany',
        target: 'tag',
        inversedBy: 'articles',
      },
    },
    // …
  ```

  ```json title="./src/api/[api-name]/content-types/tag/schema.json"

    // …
    attributes: {
      articles: {
        type: 'relation',
        relation: 'manyToMany',
        target: 'article',
        mappedBy: 'tag',
      },
    },
    // …
  ```

</details>

<!-- ? not sure what to do with this note and the following example, that's why I commented them for now -->
<!-- :::tip NOTE
The `tableName` key defines the name of the join table. It has to be specified once. If it is not specified, Strapi will use a generated default one. It is useful to define the name of the join table when the name generated by Strapi is too long for the database you use.
:::

**Path —** `./src/api/category/models/Category.settings.json`.

```js
{
  "attributes": {
    "products": {
      "collection": "product",
      "via": "categories"
    }
  }
}
``` -->

</TabItem>

</Tabs>

#### Custom fields

[Custom fields](/cms/features/custom-fields) extend Strapi’s capabilities by adding new types of fields to content-types. Custom fields are explicitly defined in the [attributes](#model-attributes) of a model with `type: customField`.

Custom fields' attributes also show the following specificities:

- a `customField` attribute whose value acts as a unique identifier to indicate which registered custom field should be used. Its value follows:
   - either the `plugin::plugin-name.field-name` format if a plugin created the custom field 
   - or the `global::field-name` format for a custom field specific to the current Strapi application
- and additional parameters depending on what has been defined when registering the custom field (see [custom fields documentation](/cms/features/custom-fields)).

```json title="./src/api/[apiName]/[content-type-name]/content-types/schema.json"

{
  // …
  "attributes": {
    "attributeName": { // attributeName would be replaced by the actual attribute name
      "type": "customField",
      "customField": "plugin::color-picker.color",
      "options": {
        "format": "hex"
      }
    }
  }
  // …
}
```

#### Components {#components-json}

Component fields create a relation between a content-type and a component structure. Components are explicitly defined in the [attributes](#model-attributes) of a model with `type: 'component'` and accept the following additional parameters:

| Parameter    | Type    | Description                                                                              |
| ------------ | ------- | ---------------------------------------------------------------------------------------- |
| `repeatable` | Boolean | Could be `true` or `false` depending on whether the component is repeatable or not       |
| `component`  | String  | Define the corresponding component, following this format:<br/>`<category>.<componentName>`  |

```json title="./src/api/[apiName]/restaurant/content-types/schema.json"

{
  "attributes": {
    "openinghours": {
      "type": "component",
      "repeatable": true,
      "component": "restaurant.openinghours"
    }
  }
}
```

#### Dynamic zones

Dynamic zones create a flexible space in which to compose content, based on a mixed list of [components](#components-json).

Dynamic zones are explicitly defined in the [attributes](#model-attributes)  of a model with `type: 'dynamiczone'`. They also accept a `components` array, where each component should be named following this format: `<category>.<componentName>`.

```json title="./src/api/[api-name]/content-types/article/schema.json"

{
  "attributes": {
    "body": {
      "type": "dynamiczone",
      "components": ["article.slider", "article.content"]
    }
  }
}
```

### Model options

The `options` key is used to define specific behaviors and accepts the following parameter:

| Parameter           | Type             | Description                                                                                                                                                                                                                                                                                                        |
|---------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `privateAttributes` | Array of strings | Allows treating a set of attributes as private, even if they're not actually defined as attributes in the model. It could be used to remove them from API responses timestamps. <br /><br /> The `privateAttributes` defined in the model are merged with the `privateAttributes` defined in the global Strapi configuration. |
| `draftAndPublish`   | Boolean          | Enables the draft and publish feature. <br /><br /> Default value: `true` (`false` if the content-type is created from the interactive CLI).                                                                                                                                                                                    |
| `populateCreatorFields` | Boolean | Populates `createdBy` and `updatedBy` fields in responses returned by the REST API (see [guide](/cms/api/rest/guides/populate-creator-fields) for more details).<br/><br/>Default value: `false`. |

```json title="./src/api/[api-name]/content-types/restaurant/schema.json"

{
  "options": {
    "privateAttributes": ["id", "createdAt"],
    "draftAndPublish": true
  }
}
```

### Plugin options

`pluginOptions` is an optional object allowing plugins to store configuration for a model or a specific attribute.

| Key                       | Value                         | Description                                            |
|---------------------------|-------------------------------|--------------------------------------------------------|
| `i18n`                    | `localized: true`             | Enables localization.                                  |
| `content-manager`         | `visible: false`              | Hides from Content Manager in the admin panel.         |
| `content-type-builder`    | `visible: false`              | Hides from Content-type Builder in the admin panel.    |

```json title="./src/api/[api-name]/content-types/[content-type-name]/schema.json"

{
  "attributes": {
    "name": {
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      },
      "type": "string",
      "required": true
    },
    "slug": {
      "pluginOptions": {
        "i18n": {
          "localized": true
        }
      },
      "type": "uid",
      "targetField": "name",
      "required": true
    }
    // …additional attributes
  }
}

```

## Lifecycle hooks

Lifecycle hooks are functions that get triggered when Strapi queries are called. They are triggered automatically when managing content through the administration panel or when developing custom code using `queries`·

Lifecycle hooks can be customized declaratively or programmatically.

:::caution
Lifecycles hooks are not triggered when using directly the <ExternalLink to="https://knexjs.org/" text="knex"/> library instead of Strapi functions.
:::

:::strapi Document Service API: lifecycles and middlewares
The Document Service API triggers various database lifecycle hooks based on which method is called. For a complete reference, see [Document Service API: Lifecycle hooks](/cms/migration/v4-to-v5/breaking-changes/lifecycle-hooks-document-service#table). Bulk actions lifecycles (`createMany`, `updateMany`, `deleteMany`) will never be triggered by a Document Service API method. [Document Service middlewares](/cms/api/document-service/middlewares) can be implemented too.
:::

### Available lifecycle events

The following lifecycle events are available:

- `beforeCreate`
- `beforeCreateMany`
- `afterCreate`
- `afterCreateMany`
- `beforeUpdate`
- `beforeUpdateMany`
- `afterUpdate`
- `afterUpdateMany`
- `beforeDelete`
- `beforeDeleteMany`
- `afterDelete`
- `afterDeleteMany`
- `beforeCount`
- `afterCount`
- `beforeFindOne`
- `afterFindOne`
- `beforeFindMany`
- `afterFindMany`

### Hook `event` object

Lifecycle hooks are functions that take an `event` parameter, an object with the following keys:

| Key      | Type              | Description                                                                                                                                                      |
| -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action` | String            | Lifecycle event that has been triggered (see [list](#available-lifecycle-events))                                                                                |
| `model`  | Array of strings (uid)            | An array of uids of the content-types whose events will be listened to.<br />If this argument is not supplied, events are listened on all content-types. |
| `params` | Object            | Accepts the following parameters:<ul><li>`data`</li><li>`select`</li><li>`where`</li><li>`orderBy`</li><li>`limit`</li><li>`offset`</li><li>`populate`</li></ul> |
| `result` | Object            | _Optional, only available with `afterXXX` events_<br /><br />Contains the result of the action.                                                                      |
| `state`  | Object            | Query state, can be used to share state between `beforeXXX` and `afterXXX` events of a query.                                                               |
<!-- TODO: `state` has not been implemented yet, ask for more info once done -->

### Declarative and programmatic usage

To configure a content-type lifecycle hook, create a `lifecycles.js` file in the `./src/api/[api-name]/content-types/[content-type-name]/` folder.

Each event listener is called sequentially. They can be synchronous or asynchronous.

<Tabs groupdId="js-ts">

<TabItem value="js" label="JavaScript">

```js title="./src/api/[api-name]/content-types/[content-type-name]/lifecycles.js"

module.exports = {
  beforeCreate(event) {
    const { data, where, select, populate } = event.params;

    // let's do a 20% discount everytime
    event.params.data.price = event.params.data.price * 0.8;
  },

  afterCreate(event) {
    const { result, params } = event;

    // do something to the result;
  },
};
```

</TabItem>

<TabItem value="ts" label="TypeScript">

```js title="./src/api/[api-name]/content-types/[content-type-name]/lifecycles.ts"

export default {
  beforeCreate(event) {
    const { data, where, select, populate } = event.params;

    // let's do a 20% discount everytime
    event.params.data.price = event.params.data.price * 0.8;
  },

  afterCreate(event) {
    const { result, params } = event;

    // do something to the result;
  },
};
```

</TabItem>
</Tabs>

Using the database layer API, it's also possible to register a subscriber and listen to events programmatically:

```js title="./src/index.js"
module.exports = {
  async bootstrap({ strapi }) {
// registering a subscriber
    strapi.db.lifecycles.subscribe({
      models: [], // optional;

      beforeCreate(event) {
        const { data, where, select, populate } = event.params;

        event.state = 'doStuffAfterWards';
      },

      afterCreate(event) {
        if (event.state === 'doStuffAfterWards') {
        }

        const { result, params } = event;

        // do something to the result
      },
    });

    // generic subscribe for generic handling
    strapi.db.lifecycles.subscribe((event) => {
      if (event.action === 'beforeCreate') {
        // do something
      }
    });
  }
}
```


# REST API reference

The REST API allows accessing the [content-types](/cms/backend-customization/models) through API endpoints. Strapi automatically creates [API endpoints](#endpoints) when a content-type is created. [API parameters](/cms/api/rest/parameters) can be used when querying API endpoints to refine the results.

This section of the documentation is for the REST API reference for content-types. We also have [guides](/cms/api/rest/guides/intro) available for specific use cases.

:::prerequisites
All content types are private by default and need to be either made public or queries need to be authenticated with the proper permissions. See the [Quick Start Guide](/cms/quick-start#step-4-set-roles--permissions), the user guide for the [Users & Permissions feature](/cms/features/users-permissions#roles), and [API tokens configuration documentation](/cms/features/api-tokens) for more details.
:::

:::note
By default, the REST API responses only include top-level fields and does not populate any relations, media fields, components, or dynamic zones. Use the [`populate` parameter](/cms/api/rest/populate-select) to populate specific fields. Ensure that the find permission is given to the field(s) for the relation(s) you populate.
:::

:::strapi Strapi Client
The [Strapi Client](/cms/api/client) library simplifies interactions with your Strapi back end, providing a way to fetch, create, update, and delete content.
:::

## Endpoints

For each Content-Type, the following endpoints are automatically generated:

<details>

<summary>Plural API ID vs. Singular API ID:</summary>

In the following tables:

- `:singularApiId` refers to the value of the "API ID (Singular)" field of the content-type,
- and `:pluralApiId` refers to the value of the "API ID (Plural)" field of the content-type.

These values are defined when creating a content-type in the Content-Type Builder, and can be found while editing a content-type in the admin panel (see [User Guide](/cms/features/content-type-builder#creating-content-types)). For instance, by default, for an "Article" content-type:

- `:singularApiId` will be `article`
- `:pluralApiId` will be `articles`

<ThemedImage
alt="Screenshot of the Content-Type Builder to retrieve singular and plural API IDs"
sources={{
  light: '/img/assets/rest-api/plural-api-id.png',
  dark: '/img/assets/rest-api/plural-api-id_DARK.png'
}}
/>

</details>

<Tabs groupId="collection-single">

<TabItem value="collection" label="Collection type">

| Method   | URL                             | Description                           |
| -------- | ------------------------------- | ------------------------------------- |
| `GET`    | `/api/:pluralApiId`             | [Get a list of document](#get-all) |
| `POST`   | `/api/:pluralApiId`             | [Create a document](#create)   |
| `GET`    | `/api/:pluralApiId/:documentId` | [Get a document](#get)         |
| `PUT`    | `/api/:pluralApiId/:documentId` | [Update a document](#update)   |
| `DELETE` | `/api/:pluralApiId/:documentId` | [Delete a document](#delete)   |

</TabItem>

<TabItem value="single" label="Single type">

| Method   | URL                   | Description                                |
| -------- | --------------------- | ------------------------------------------ |
| `GET`    | `/api/:singularApiId` | [Get a document](#get)              |
| `PUT`    | `/api/:singularApiId` | [Update/Create a document](#update) |
| `DELETE` | `/api/:singularApiId` | [Delete a document](#delete)        |

</TabItem>

</Tabs>

<details>

<summary>Real-world examples of endpoints:</summary>

The following endpoint examples are taken from the <ExternalLink to="https://github.com/strapi/foodadvisor" text="FoodAdvisor"/> example application.

<Tabs groupId="collection-single">

<TabItem value="collection" label="Collection type">

`Restaurant` **Content type**

| Method | URL                      | Description               |
| ------ | ------------------------ | ------------------------- |
| GET    | `/api/restaurants`       | Get a list of restaurants |
| POST   | `/api/restaurants`       | Create a restaurant       |
| GET    | `/api/restaurants/:documentId`   | Get a specific restaurant |
| DELETE | `/api/restaurants/:documentId`   | Delete a restaurant       |
| PUT    | `/api/restaurants/:documentId`   | Update a restaurant       |

</TabItem>

<TabItem value="single" label="Single type">

`Homepage` **Content type**

| Method | URL             | Description                        |
| ------ | --------------- | ---------------------------------- |
| GET    | `/api/homepage` | Get the homepage content           |
| PUT    | `/api/homepage` | Update/create the homepage content |
| DELETE | `/api/homepage` | Delete the homepage content        |

</TabItem>
</Tabs>
</details>

:::strapi Upload API
The Upload package (which powers the [Media Library feature](/cms/features/media-library)) has a specific API accessible through its [`/api/upload` endpoints](/cms/api/rest/upload).
:::

:::note
[Components](/cms/backend-customization/models#components-json) don't have API endpoints.
:::

## Requests

:::strapi Strapi 5 vs. Strapi v4
Strapi 5's Content API includes 2 major differences with Strapi v4:

- The response format has been flattened, which means attributes are no longer nested in a `data.attributes` object and are directly accessible at the first level of the `data` object (e.g., a content-type's "title" attribute is accessed with `data.title`).
- Strapi 5 now uses **documents** <DocumentDefinition/> and documents are accessed by their `documentId` (see [breaking change entry](/cms/migration/v4-to-v5/breaking-changes/use-document-id) for details)
:::

Requests return a response as an object which usually includes the following keys:

- `data`: the response data itself, which could be:
  - a single document, as an object with the following keys:
    - `id` (integer)
    - `documentId` (string), which is the unique identifier to use when querying a given document,
    - the attributes (each attribute's type depends on the attribute, see [models attributes](/cms/backend-customization/models#model-attributes) documentation for details)
    - `meta` (object)
  - a list of documents, as an array of objects
  - a custom response

- `meta` (object): information about pagination, publication state, available locales, etc.

- `error` (object, _optional_): information about any [error](/cms/error-handling) thrown by the request

:::note
Some plugins (including Users & Permissions and Upload) may not follow this response format.
:::

### Get documents {#get-all}

Returns documents matching the query filters (see [API parameters](/cms/api/rest/parameters) documentation).

:::tip Tip: Strapi 5 vs. Strapi 4
In Strapi 5 the response format has been flattened, and attributes are directly accessible from the `data` object instead of being nested in `data.attributes`.

You can pass an optional header while you're migrating to Strapi 5 (see the [related breaking change](/cms/migration/v4-to-v5/breaking-changes/new-response-format)).
:::

<ApiCall>

<Request>

`GET http://localhost:1337/api/restaurants`

</Request>

<Response>

```json
{
  "data": [
    {
      "id": 2,
      "documentId": "hgv1vny5cebq2l3czil1rpb3",
      "Name": "BMK Paris Bamako",
      "Description": null,
      "createdAt": "2024-03-06T13:42:05.098Z",
      "updatedAt": "2024-03-06T13:42:05.098Z",
      "publishedAt": "2024-03-06T13:42:05.103Z",
      "locale": "en"
    },
    {
      "id": 4,
      "documentId": "znrlzntu9ei5onjvwfaalu2v",
      "Name": "Biscotte Restaurant",
      "Description": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine based on fresh, quality products, often local, organic when possible, and always produced by passionate producers."
            }
          ]
        }
      ],
      "createdAt": "2024-03-06T13:43:30.172Z",
      "updatedAt": "2024-03-06T13:43:30.172Z",
      "publishedAt": "2024-03-06T13:43:30.175Z",
      "locale": "en"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

</Response>

</ApiCall>

### Get a document {#get}

Returns a document by `documentId`.

:::strapi Strapi 5 vs. Strapi v4
In Strapi 5, a specific document is reached by its `documentId`.
:::

<ApiCall>

<Request title="Example request">

`GET http://localhost:1337/api/restaurants/j964065dnjrdr4u89weh79xl`

</Request>

<Response title="Example response">

```json
{
  "data": {
    "id": 6,
    "documentId": "znrlzntu9ei5onjvwfaalu2v",
    "Name": "Biscotte Restaurant",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine bassics, such as 4 Formaggi or Calzone, and our original creations such as Do Luigi or Nduja."
          }
        ]
      }
    ],
    "createdAt": "2024-02-27T10:19:04.953Z",
    "updatedAt": "2024-03-05T15:52:05.591Z",
    "publishedAt": "2024-03-05T15:52:05.600Z",
    "locale": "en"
  },
  "meta": {}
}

```

</Response>

</ApiCall>

### Create a document {#create}

Creates a document and returns its value.

If the [Internationalization (i18n) plugin](/cms/features/internationalization) is installed, it's possible to use POST requests to the REST API to [create localized documents](/cms/api/rest/locale#rest-delete).

:::note
While creating a document, you can define its relations and their order (see [Managing relations through the REST API](/cms/api/rest/relations.md) for more details).
:::

<ApiCall>

<Request title="Example request">

`POST http://localhost:1337/api/restaurants`

```json
{ 
  "data": {
    "Name": "Restaurant D",
    "Description": [ // uses the "Rich text (blocks)" field type
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

</Request>

<Response title="Example response">

```json
{
  "data": {
    "documentId": "bw64dnu97i56nq85106yt4du",
    "Name": "Restaurant D",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-05T16:44:47.689Z",
    "updatedAt": "2024-03-05T16:44:47.689Z",
    "publishedAt": "2024-03-05T16:44:47.687Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### Update a document {#update}

Partially updates a document by `id` and returns its value.

Send a `null` value to clear fields.

:::note NOTES
* Even with the [Internationalization (i18n) plugin](/cms/features/internationalization) installed, it's currently not possible to [update the locale of a document](/cms/api/rest/locale#rest-update).
* While updating a document, you can define its relations and their order (see [Managing relations through the REST API](/cms/api/rest/relations) for more details).
:::

<ApiCall>

<Request title="Example request">

`PUT http://localhost:1337/api/restaurants/hgv1vny5cebq2l3czil1rpb3`

```json
{ 
  "data": {
    "Name": "BMK Paris Bamako", // we didn't change this field but still need to include it
    "Description": [ // uses the "Rich text (blocks)" field type
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

</Request>

<Response title="Example response">

```json
{
  "data": {
    "id": 9,
    "documentId": "hgv1vny5cebq2l3czil1rpb3",
    "Name": "BMK Paris Bamako",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-06T13:42:05.098Z",
    "updatedAt": "2024-03-06T14:16:56.883Z",
    "publishedAt": "2024-03-06T14:16:56.895Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### Delete a document {#delete}

Deletes a document.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

<ApiCall>

<Request title="Example request">

`DELETE http://localhost:1337/api/restaurants/bw64dnu97i56nq85106yt4du`

</Request>

</ApiCall>


--- 
title: REST API reference
description: Interact with your Content-Types using the REST API endpoints Strapi generates for you.
displayed_sidebar: cmsSidebar
tags:
- API
- Content API
- documentId
- Documents
- plural API ID
- REST API
- singular API ID
---

# REST API reference

The REST API allows accessing the [content-types](/cms/backend-customization/models) through API endpoints. Strapi automatically creates [API endpoints](#endpoints) when a content-type is created. [API parameters](/cms/api/rest/parameters) can be used when querying API endpoints to refine the results.

This section of the documentation is for the REST API reference for content-types. We also have [guides](/cms/api/rest/guides/intro) available for specific use cases.

:::prerequisites
All content types are private by default and need to be either made public or queries need to be authenticated with the proper permissions. See the [Quick Start Guide](/cms/quick-start#step-4-set-roles--permissions), the user guide for the [Users & Permissions feature](/cms/features/users-permissions#roles), and [API tokens configuration documentation](/cms/features/api-tokens) for more details.
:::

:::note
By default, the REST API responses only include top-level fields and does not populate any relations, media fields, components, or dynamic zones. Use the [`populate` parameter](/cms/api/rest/populate-select) to populate specific fields. Ensure that the find permission is given to the field(s) for the relation(s) you populate.
:::

:::strapi Strapi Client
The [Strapi Client](/cms/api/client) library simplifies interactions with your Strapi back end, providing a way to fetch, create, update, and delete content.
:::

## Endpoints

For each Content-Type, the following endpoints are automatically generated:

<details>

<summary>Plural API ID vs. Singular API ID:</summary>

In the following tables:

- `:singularApiId` refers to the value of the "API ID (Singular)" field of the content-type,
- and `:pluralApiId` refers to the value of the "API ID (Plural)" field of the content-type.

These values are defined when creating a content-type in the Content-Type Builder, and can be found while editing a content-type in the admin panel (see [User Guide](/cms/features/content-type-builder#creating-content-types)). For instance, by default, for an "Article" content-type:

- `:singularApiId` will be `article`
- `:pluralApiId` will be `articles`

<ThemedImage
alt="Screenshot of the Content-Type Builder to retrieve singular and plural API IDs"
sources={{
  light: '/img/assets/rest-api/plural-api-id.png',
  dark: '/img/assets/rest-api/plural-api-id_DARK.png'
}}
/>

</details>

<Tabs groupId="collection-single">

<TabItem value="collection" label="Collection type">

| Method   | URL                             | Description                           |
| -------- | ------------------------------- | ------------------------------------- |
| `GET`    | `/api/:pluralApiId`             | [Get a list of document](#get-all) |
| `POST`   | `/api/:pluralApiId`             | [Create a document](#create)   |
| `GET`    | `/api/:pluralApiId/:documentId` | [Get a document](#get)         |
| `PUT`    | `/api/:pluralApiId/:documentId` | [Update a document](#update)   |
| `DELETE` | `/api/:pluralApiId/:documentId` | [Delete a document](#delete)   |

</TabItem>

<TabItem value="single" label="Single type">

| Method   | URL                   | Description                                |
| -------- | --------------------- | ------------------------------------------ |
| `GET`    | `/api/:singularApiId` | [Get a document](#get)              |
| `PUT`    | `/api/:singularApiId` | [Update/Create a document](#update) |
| `DELETE` | `/api/:singularApiId` | [Delete a document](#delete)        |

</TabItem>

</Tabs>

<details>

<summary>Real-world examples of endpoints:</summary>

The following endpoint examples are taken from the <ExternalLink to="https://github.com/strapi/foodadvisor" text="FoodAdvisor"/> example application.

<Tabs groupId="collection-single">

<TabItem value="collection" label="Collection type">

`Restaurant` **Content type**

| Method | URL                      | Description               |
| ------ | ------------------------ | ------------------------- |
| GET    | `/api/restaurants`       | Get a list of restaurants |
| POST   | `/api/restaurants`       | Create a restaurant       |
| GET    | `/api/restaurants/:documentId`   | Get a specific restaurant |
| DELETE | `/api/restaurants/:documentId`   | Delete a restaurant       |
| PUT    | `/api/restaurants/:documentId`   | Update a restaurant       |

</TabItem>

<TabItem value="single" label="Single type">

`Homepage` **Content type**

| Method | URL             | Description                        |
| ------ | --------------- | ---------------------------------- |
| GET    | `/api/homepage` | Get the homepage content           |
| PUT    | `/api/homepage` | Update/create the homepage content |
| DELETE | `/api/homepage` | Delete the homepage content        |

</TabItem>
</Tabs>
</details>

:::strapi Upload API
The Upload package (which powers the [Media Library feature](/cms/features/media-library)) has a specific API accessible through its [`/api/upload` endpoints](/cms/api/rest/upload).
:::

:::note
[Components](/cms/backend-customization/models#components-json) don't have API endpoints.
:::

## Requests

:::strapi Strapi 5 vs. Strapi v4
Strapi 5's Content API includes 2 major differences with Strapi v4:

- The response format has been flattened, which means attributes are no longer nested in a `data.attributes` object and are directly accessible at the first level of the `data` object (e.g., a content-type's "title" attribute is accessed with `data.title`).
- Strapi 5 now uses **documents** <DocumentDefinition/> and documents are accessed by their `documentId` (see [breaking change entry](/cms/migration/v4-to-v5/breaking-changes/use-document-id) for details)
:::

Requests return a response as an object which usually includes the following keys:

- `data`: the response data itself, which could be:
  - a single document, as an object with the following keys:
    - `id` (integer)
    - `documentId` (string), which is the unique identifier to use when querying a given document,
    - the attributes (each attribute's type depends on the attribute, see [models attributes](/cms/backend-customization/models#model-attributes) documentation for details)
    - `meta` (object)
  - a list of documents, as an array of objects
  - a custom response

- `meta` (object): information about pagination, publication state, available locales, etc.

- `error` (object, _optional_): information about any [error](/cms/error-handling) thrown by the request

:::note
Some plugins (including Users & Permissions and Upload) may not follow this response format.
:::

### Get documents {#get-all}

Returns documents matching the query filters (see [API parameters](/cms/api/rest/parameters) documentation).

:::tip Tip: Strapi 5 vs. Strapi 4
In Strapi 5 the response format has been flattened, and attributes are directly accessible from the `data` object instead of being nested in `data.attributes`.

You can pass an optional header while you're migrating to Strapi 5 (see the [related breaking change](/cms/migration/v4-to-v5/breaking-changes/new-response-format)).
:::

<ApiCall>

<Request>

`GET http://localhost:1337/api/restaurants`

</Request>

<Response>

```json
{
  "data": [
    {
      "id": 2,
      "documentId": "hgv1vny5cebq2l3czil1rpb3",
      "Name": "BMK Paris Bamako",
      "Description": null,
      "createdAt": "2024-03-06T13:42:05.098Z",
      "updatedAt": "2024-03-06T13:42:05.098Z",
      "publishedAt": "2024-03-06T13:42:05.103Z",
      "locale": "en"
    },
    {
      "id": 4,
      "documentId": "znrlzntu9ei5onjvwfaalu2v",
      "Name": "Biscotte Restaurant",
      "Description": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine based on fresh, quality products, often local, organic when possible, and always produced by passionate producers."
            }
          ]
        }
      ],
      "createdAt": "2024-03-06T13:43:30.172Z",
      "updatedAt": "2024-03-06T13:43:30.172Z",
      "publishedAt": "2024-03-06T13:43:30.175Z",
      "locale": "en"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

</Response>

</ApiCall>

### Get a document {#get}

Returns a document by `documentId`.

:::strapi Strapi 5 vs. Strapi v4
In Strapi 5, a specific document is reached by its `documentId`.
:::

<ApiCall>

<Request title="Example request">

`GET http://localhost:1337/api/restaurants/j964065dnjrdr4u89weh79xl`

</Request>

<Response title="Example response">

```json
{
  "data": {
    "id": 6,
    "documentId": "znrlzntu9ei5onjvwfaalu2v",
    "Name": "Biscotte Restaurant",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine bassics, such as 4 Formaggi or Calzone, and our original creations such as Do Luigi or Nduja."
          }
        ]
      }
    ],
    "createdAt": "2024-02-27T10:19:04.953Z",
    "updatedAt": "2024-03-05T15:52:05.591Z",
    "publishedAt": "2024-03-05T15:52:05.600Z",
    "locale": "en"
  },
  "meta": {}
}

```

</Response>

</ApiCall>

### Create a document {#create}

Creates a document and returns its value.

If the [Internationalization (i18n) plugin](/cms/features/internationalization) is installed, it's possible to use POST requests to the REST API to [create localized documents](/cms/api/rest/locale#rest-delete).

:::note
While creating a document, you can define its relations and their order (see [Managing relations through the REST API](/cms/api/rest/relations.md) for more details).
:::

<ApiCall>

<Request title="Example request">

`POST http://localhost:1337/api/restaurants`

```json
{ 
  "data": {
    "Name": "Restaurant D",
    "Description": [ // uses the "Rich text (blocks)" field type
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

</Request>

<Response title="Example response">

```json
{
  "data": {
    "documentId": "bw64dnu97i56nq85106yt4du",
    "Name": "Restaurant D",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-05T16:44:47.689Z",
    "updatedAt": "2024-03-05T16:44:47.689Z",
    "publishedAt": "2024-03-05T16:44:47.687Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### Update a document {#update}

Partially updates a document by `id` and returns its value.

Send a `null` value to clear fields.

:::note NOTES
* Even with the [Internationalization (i18n) plugin](/cms/features/internationalization) installed, it's currently not possible to [update the locale of a document](/cms/api/rest/locale#rest-update).
* While updating a document, you can define its relations and their order (see [Managing relations through the REST API](/cms/api/rest/relations) for more details).
:::

<ApiCall>

<Request title="Example request">

`PUT http://localhost:1337/api/restaurants/hgv1vny5cebq2l3czil1rpb3`

```json
{ 
  "data": {
    "Name": "BMK Paris Bamako", // we didn't change this field but still need to include it
    "Description": [ // uses the "Rich text (blocks)" field type
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ]
  }
}
```

</Request>

<Response title="Example response">

```json
{
  "data": {
    "id": 9,
    "documentId": "hgv1vny5cebq2l3czil1rpb3",
    "Name": "BMK Paris Bamako",
    "Description": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "A very short description goes here."
          }
        ]
      }
    ],
    "createdAt": "2024-03-06T13:42:05.098Z",
    "updatedAt": "2024-03-06T14:16:56.883Z",
    "publishedAt": "2024-03-06T14:16:56.895Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### Delete a document {#delete}

Deletes a document.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

<ApiCall>

<Request title="Example request">

`DELETE http://localhost:1337/api/restaurants/bw64dnu97i56nq85106yt4du`

</Request>

</ApiCall>
---
title: Filters
description: Use Strapi's REST API to filter the results of your requests.
sidebarDepth: 3
sidebar_label:  Filters
displayed_sidebar: cmsSidebar
tags:
- API
- complex filtering
- Content API
- deep filtering
- filters
- find
- interactive query builder
- locale
- REST API
- qs library
---

import QsIntroFull from '/docs/snippets/qs-intro-full.md'
import QsForQueryBody from '/docs/snippets/qs-for-query-body.md'
import QsForQueryTitle from '/docs/snippets/qs-for-query-title.md'
import DeepFilteringBlogLink from '/docs/snippets/deep-filtering-blog.md'

# REST API: Filters

The [REST API](/cms/api/rest) offers the ability to filter results found with its ["Get entries"](/cms/api/rest#get-all) method.<br/>
Using optional Strapi features can provide some more filters:

- If the [Internationalization (i18n) plugin](/cms/features/internationalization) is enabled on a content-type, it's possible to filter by locale.
- If the [Draft & Publish](/cms/features/draft-and-publish) is enabled, it's possible to filter based on a `published` (default) or `draft` status.

:::tip
<QsIntroFull />
:::

Queries can accept a `filters` parameter with the following syntax:

`GET /api/:pluralApiId?filters[field][operator]=value`

The following operators are available:

| Operator        | Description                              |
| --------------- | ---------------------------------------- |
| `$eq`           | Equal                                    |
| `$eqi`          | Equal (case-insensitive)                 |
| `$ne`           | Not equal                                |
| `$nei`          | Not equal (case-insensitive)             |
| `$lt`           | Less than                                |
| `$lte`          | Less than or equal to                    |
| `$gt`           | Greater than                             |
| `$gte`          | Greater than or equal to                 |
| `$in`           | Included in an array                     |
| `$notIn`        | Not included in an array                 |
| `$contains`     | Contains                                 |
| `$notContains`  | Does not contain                         |
| `$containsi`    | Contains (case-insensitive)              |
| `$notContainsi` | Does not contain (case-insensitive)      |
| `$null`         | Is null                                  |
| `$notNull`      | Is not null                              |
| `$between`      | Is between                               |
| `$startsWith`   | Starts with                              |
| `$startsWithi`  | Starts with (case-insensitive)           |
| `$endsWith`     | Ends with                                |
| `$endsWithi`    | Ends with (case-insensitive)             |
| `$or`           | Joins the filters in an "or" expression  |
| `$and`          | Joins the filters in an "and" expression |
| `$not`          | Joins the filters in an "not" expression |

When several fields are passed in the `filters` object, they are implicitly combined with `$and` (e.g. `GET /api/restaurants?filters[stars][$gte]=3&filters[open][$eq]=true` only returns restaurants that are open and have at least 3 stars).

:::tip
`$and`, `$or` and `$not` operators can be nested inside one another.
:::

:::caution
By default, the filters can only be used from `find` endpoints generated by the Content-type Builder and the CLI.
:::

## Example: Find users having 'John' as a first name

You can use the `$eq` filter operator to find an exact match.

<br />

<ApiCall>
<Request title="Find users having 'John' as first name">

`GET /api/users?filters[username][$eq]=John`

</Request>

<details>
<summary>JavaScript query (built with the qs library):</summary>

<QsForQueryBody />

```js
const qs = require('qs');
const query = qs.stringify({
  filters: {
    username: {
      $eq: 'John',
    },
  },
}, {
  encodeValuesOnly: true, // prettify URL
});

await request(`/api/users?${query}`);
```

</details>

<Response title="Example response">

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "znrlzntu9ei5onjvwfaalu2v",
      "username": "John",
      "email": "john@test.com",
      "provider": "local",
      "confirmed": true,
      "blocked": false,
      "createdAt": "2021-12-03T20:08:17.740Z",
      "updatedAt": "2021-12-03T20:08:17.740Z"
    }
  ],
  "meta": {
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "pageCount": 1,
    "total": 1
  }
}
```

</Response>
</ApiCall>

## Example: Find multiple restaurants with ids 3, 6,8

You can use the `$in` filter operator with an array of values to find multiple exact values.

<br />

<ApiCall>
<Request title="Find multiple restaurants with ids 3, 6, 8">

`GET /api/restaurants?filters[id][$in][0]=3&filters[id][$in][1]=6&filters[id][$in][2]=8`

</Request>

<details>
<summary>JavaScript query (built with the qs library):</summary>

<QsForQueryBody />

```js
const qs = require('qs');
const query = qs.stringify({
  filters: {
    id: {
      $in: [3, 6, 8],
    },
  },
}, {
  encodeValuesOnly: true, // prettify URL
});

await request(`/api/restaurants?${query}`);
```

</details>

<Response title="Example response">

```json
{
  "data": [
    {
      "id": 3,
      "documentId": "ethwxjxtvuxl89jq720e38uk",
      "name": "test3",
      // ...
    },
    {
      "id": 6,
      "documentId": "ethwxjxtvuxl89jq720e38uk",
      "name": "test6",
      // ...
    },
    {
      "id": 8,
      "documentId": "cf07g1dbusqr8mzmlbqvlegx",
      "name": "test8",
      // ...
    },
  ],
  "meta": {
    // ...
  }
}
```

</Response>
</ApiCall>

## Complex filtering

Complex filtering is combining multiple filters using advanced methods such as combining `$and` & `$or`. This allows for more flexibility to request exactly the data needed.

<br />
<ApiCall>
<Request title="Find books with 2 possible dates and a specific author">

`GET /api/books?filters[$and][0][$or][0][date][$eq]=2020-01-01&filters[$and][0][$or][1][date][$eq]=2020-01-02&filters[$and][1][author][name][$eq]=Kai%20doe`

</Request>

<details>
<summary>JavaScript query (built with the qs library):</summary>

<QsForQueryBody />

```js
const qs = require('qs');
const query = qs.stringify({
  filters: {
    $and: [
      {
        $or: [
          {
            date: {
              $eq: '2020-01-01',
            },
          },
          {
            date: {
              $eq: '2020-01-02',
            },
          },
        ],
      },
      {
        author: {
          name: {
            $eq: 'Kai doe',
          },
        },
      },
    ],
  },
}, {
  encodeValuesOnly: true, // prettify URL
});

await request(`/api/books?${query}`);
```

</details>

<Response title="Example response">

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "rxngxzclq0zdaqtvz67hj38d",
      "name": "test1",
      "date": "2020-01-01",
      // ...
    },
    {
      "id": 2,
      "documentId": "kjkhff4e269a50b4vi16stst",
      "name": "test2",
      "date": "2020-01-02",
      // ...
    }
  ],
  "meta": {
    // ...
  }
}
```

</Response>
</ApiCall>

## Deep filtering

Deep filtering is filtering on a relation's fields.

:::note
- Relations, media fields, components, and dynamic zones are not populated by default. Use the `populate` parameter to populate these content structures (see [`populate` documentation](/cms/api/rest/populate-select#population))
- You can filter what you populate, you can also filter nested relations, but you can't use filters for polymorphic content structures (such as media fields and dynamic zones).
:::

:::caution
Querying your API with deep filters may cause performance issues.  If one of your deep filtering queries is too slow, we recommend building a custom route with an optimized version of the query.
:::

<DeepFilteringBlogLink />

<ApiCall>
<Request title="Find restaurants owned by a chef who belongs to a 5-star restaurant">

`GET /api/restaurants?filters[chef][restaurants][stars][$eq]=5`

</Request>

<details>
<summary>JavaScript query (built with the qs library):</summary>

<QsForQueryBody />

```js
const qs = require('qs');
const query = qs.stringify({
  filters: {
    chef: {
      restaurants: {
        stars: {
          $eq: 5,
        },
      },
    },
  },
}, {
  encodeValuesOnly: true, // prettify URL
});

await request(`/api/restaurants?${query}`);
```

</details>

<Response title="Example response">

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "cvsz61qg33rtyv1qljb1nrtg",
      "name": "GORDON RAMSAY STEAK",
      "stars": 5
      // ...
    },
    {
      "id": 2,
      "documentId": "uh17h7ibw0g8thit6ivi71d8",
      "name": "GORDON RAMSAY BURGER",
      "stars": 5
      // ...
    }
  ],
  "meta": {
    // ...
  }
}
```

</Response>
</ApiCall>
---
title: Locale
description: Browse the REST API reference for the locale parameter to take advantage of the Internationalization feature through REST.
toc_max_heading_level: 5
tags:
- REST API
- Internationalization
- API
- locale
- Content API
- find
- interactive query builder
- qs library
---

import QsIntroFull from '/docs/snippets/qs-intro-full.md'
import QsForQueryBody from '/docs/snippets/qs-for-query-body.md'
import QsForQueryTitle from '/docs/snippets/qs-for-query-title.md'

# REST API: `locale`

The [Internationalization (i18n) feature](/cms/features/internationalization) adds new abilities to the [REST API](/cms/api/rest).

:::prerequisites
To work with API content for a locale, please ensure the locale has been already [added to Strapi in the admin panel](/cms/features/internationalization#settings).
:::

The `locale` [API parameter](/cms/api/rest/parameters) can be used to work with documents only for a specified locale. `locale` takes a locale code as a value (see <ExternalLink to="https://github.com/strapi/strapi/blob/main/packages/plugins/i18n/server/src/constants/iso-locales.json" text="full list of available locales"/>).

:::tip
If the `locale` parameter is not defined, it will be set to the default locale. `en` is the default locale when a new Strapi project is created, but another locale can be [set as the default locale](/cms/features/internationalization#settings) in the admin panel.

For instance, by default, a GET request to `/api/restaurants` will return the same response as a request to `/api/restaurants?locale=en`.
:::

The following table lists the new possible use cases added by i18n to the REST API and gives syntax examples (you can click on requests to jump to the corresponding section with more details):

<Tabs groupId="collection-single">

<TabItem value="collection" label="For collection types">

| Use case | Syntax example<br/>and link for more information |
|---------|-------|
| Get all documents in a specific locale | [`GET /api/restaurants?locale=fr`](#rest-get-all) |
| Get a specific locale version for a document | [`GET /api/restaurants/abcdefghijklmno456?locale=fr`](#get-one-collection-type) |
| Create a new document for the default locale | [`POST /api/restaurants`](#rest-create-default-locale)<br/>+ pass attributes in the request body |
| Create a new document for a specific locale | [`POST /api/restaurants`](#rest-create-specific-locale)<br/>+ pass attributes **and locale** in the request body |
| Create a new, or update an existing, locale version for an existing document | [`PUT /api/restaurants/abcdefghijklmno456?locale=fr`](#rest-put-collection-type)<br/>+ pass attributes in the request body |
| Delete a specific locale version of a document | [`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`](#rest-delete-collection-type) |

</TabItem>

<TabItem value="single" label="For single types">

| Use case                                     | Syntax example<br/>and link for more information |
|----------------------------------------------|--------------------------------------------------|
| Get a specific locale version for a document | [`GET /api/homepage?locale=fr`](#get-one-single-type)  |
| Create a new, or update an existing, locale version for an existing document | [`PUT /api/homepage?locale=fr`](#rest-put-single-type)<br/>+ pass attributes in the request body |
| Delete a specific locale version of a document | [`DELETE /api/homepage?locale=fr`](#rest-delete-single-type) |

</TabItem>
</Tabs>

### `GET` Get all documents in a specific locale {#rest-get-all}

<ApiCall>

<Request> 

`GET http://localhost:1337/api/restaurants?locale=fr`

</Request>

<Response> 

```json
{
  "data": [
    {
      "id": 5,
      "documentId": "h90lgohlzfpjf3bvan72mzll",
      "Title": "Meilleures pizzas",
      "Body": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "On déguste les meilleures pizzas de la ville à la Pizzeria Arrivederci."
            }
          ]
        }
      ],
      "createdAt": "2024-03-06T22:08:59.643Z",
      "updatedAt": "2024-03-06T22:10:21.127Z",
      "publishedAt": "2024-03-06T22:10:21.130Z",
      "locale": "fr"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 1
    }
  }
}
```

</Response>
</ApiCall>

### `GET` Get a document in a specific locale {#rest-get}

To get a specific document in a given locale, add the `locale` parameter to the query:

| Use case             | Syntax format and link for more information                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| In a collection type | [`GET /api/content-type-plural-name/document-id?locale=locale-code`](#get-one-collection-type) |
| In a single type     | [`GET /api/content-type-singular-name?locale=locale-code`](#get-one-single-type)               |

#### Collection types {#get-one-collection-type}

To get a specific document in a collection type in a given locale, add the `locale` parameter to the query, after the `documentId`:

<ApiCall>

<Request>

`GET /api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

</Request>

<Response>

```json
{
  "data": [
    {
      "id": 22,
      "documentId": "lr5wju2og49bf820kj9kz8c3",
      "Name": "Biscotte Restaurant",
      "Description": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "Bienvenue au restaurant Biscotte! Le Restaurant Biscotte propose une cuisine à base de produits frais et de qualité, souvent locaux, biologiques lorsque cela est possible, et toujours produits par des producteurs passionnés."
            }
          ]
        }
      ],
      // …
      "locale": "fr"
    },
    // …
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 3
    }
  }
}
```

</Response>

</ApiCall>

#### Single types {#get-one-single-type}

To get a specific single type document in a given locale, add the `locale` parameter to the query, after the single type name:

<ApiCall>

<Request>

`GET /api/homepage?locale=fr`

</Request>

<Response>

```json
{
  "data": {
    "id": 10,
    "documentId": "ukbpbnu8kbutpn98rsanyi50",
    "Title": "Page d'accueil",
    "Body": null,
    "createdAt": "2024-03-07T13:28:26.349Z",
    "updatedAt": "2024-03-07T13:28:26.349Z",
    "publishedAt": "2024-03-07T13:28:26.353Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### `POST` Create a new localized document for a collection type {#rest-create}

To create a localized document from scratch, send a POST request to the Content API. Depending on whether you want to create it for the default locale or for another locale, you might need to pass the `locale` parameter in the request's body

| Use case                      | Syntax format and link for more information                                               |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Create for the default locale | [`POST /api/content-type-plural-name`](#rest-create-default-locale) |
| Create for a specific locale  | [`POST /api/content-type-plural-name`](#rest-create-specific-locale)<br/>+ pass locale in request body               |

#### For the default locale {#rest-create-default-locale}

If no locale has been passed in the request body, the document is created using the default locale for the application:

<ApiCall>
<Request> 

`POST http://localhost:1337/api/restaurants`

```json
{
  "data": {
    "Name": "Oplato",
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 13,
    "documentId": "jae8klabhuucbkgfe2xxc5dj",
    "Name": "Oplato",
    "Description": null,
    "createdAt": "2024-03-06T22:19:54.646Z",
    "updatedAt": "2024-03-06T22:19:54.646Z",
    "publishedAt": "2024-03-06T22:19:54.649Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>
</ApiCall>

#### For a specific locale {#rest-create-specific-locale}

To create a localized entry for a locale different from the default one, add the `locale` attribute to the body of the POST request:

<ApiCall>
<Request>

`POST http://localhost:1337/api/restaurants`

```json {4}
{
  "data": {
    "Name": "She's Cake",
    "locale": "fr"
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 15,
    "documentId": "ldcmn698iams5nuaehj69j5o",
    "Name": "She's Cake",
    "Description": null,
    "createdAt": "2024-03-06T22:21:18.373Z",
    "updatedAt": "2024-03-06T22:21:18.373Z",
    "publishedAt": "2024-03-06T22:21:18.378Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>
</ApiCall>

### `PUT` Create a new, or update an existing, locale version for an existing document {#rest-update}

With `PUT` requests sent to an existing document, you can:

- create another locale version of the document,
- or update an existing locale version of the document.

Send the `PUT` request to the appropriate URL, adding the `locale=your-locale-code` parameter to the query URL and passing attributes in a `data` object in the request's body:

| Use case             | Syntax format and link for more information                                               |
| -------------------- | --------------------------------------------------------------------------------------- |
| In a collection type | [`PUT /api/content-type-plural-name/document-id?locale=locale-code`](#rest-put-collection-type) |
| In a single type     | [`PUT /api/content-type-singular-name?locale=locale-code`](#rest-put-single-type)               |

:::caution
When creating a localization for existing localized entries, the body of the request can only accept localized fields.
:::

:::tip
The Content-Type should have the [`createLocalization` permission](/cms/features/rbac#collection-and-single-types) enabled, otherwise the request will return a `403: Forbidden` status.
:::

:::note
It is not possible to change the locale of an existing localized entry. When updating a localized entry, if you set a `locale` attribute in the request body it will be ignored.
:::

#### In a collection type {#rest-put-collection-type}

To create a new locale for an existing document in a collection type, add the `locale` parameter to the query, after the `documentId`, and pass data to the request's body:

<ApiCall noSideBySide>

<Request title="Example request: Creating a French locale for an existing restaurant">

`PUT http://localhost:1337/api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

```json
{
  data: {
    "Name": "She's Cake in French",
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 19,
    "documentId": "lr5wju2og49bf820kj9kz8c3",
    "Name": "She's Cake in French",
    "Description": null,
    "createdAt": "2024-03-07T12:13:09.551Z",
    "updatedAt": "2024-03-07T12:13:09.551Z",
    "publishedAt": "2024-03-07T12:13:09.554Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

#### In a single type {#rest-put-single-type}

To create a new locale for an existing single type document, add the `locale` parameter to the query, after the single type name, and pass data to the request's body:

<ApiCall>

<Request title="Example: Create a FR locale for an existing Homepage single type">

`PUT http://localhost:1337/api/homepage?locale=fr`

```json
{
  "data": {
    "Title": "Page d'accueil"
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 10,
    "documentId": "ukbpbnu8kbutpn98rsanyi50",
    "Title": "Page d'accueil",
    "Body": null,
    "createdAt": "2024-03-07T13:28:26.349Z",
    "updatedAt": "2024-03-07T13:28:26.349Z",
    "publishedAt": "2024-03-07T13:28:26.353Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

<br/>

### `DELETE` Delete a locale version of a document {#rest-delete}

To delete a locale version of a document, send a `DELETE` request with the appropriate `locale` parameter.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

#### In a collection type {#rest-delete-collection-type}

To delete only a specific locale version of a document in a collection type, add the `locale` parameter to the query after the `documentId`:

<Request>

`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`

</Request>

#### In a single type {#rest-delete-single-type}

To delete only a specific locale version of a single type document, add the `locale` parameter to the query after the single type name:

<Request>

`DELETE /api/homepage?locale=fr`

</Request>
---
title: Locale
description: Browse the REST API reference for the locale parameter to take advantage of the Internationalization feature through REST.
toc_max_heading_level: 5
tags:
- REST API
- Internationalization
- API
- locale
- Content API
- find
- interactive query builder
- qs library
---

import QsIntroFull from '/docs/snippets/qs-intro-full.md'
import QsForQueryBody from '/docs/snippets/qs-for-query-body.md'
import QsForQueryTitle from '/docs/snippets/qs-for-query-title.md'

# REST API: `locale`

The [Internationalization (i18n) feature](/cms/features/internationalization) adds new abilities to the [REST API](/cms/api/rest).

:::prerequisites
To work with API content for a locale, please ensure the locale has been already [added to Strapi in the admin panel](/cms/features/internationalization#settings).
:::

The `locale` [API parameter](/cms/api/rest/parameters) can be used to work with documents only for a specified locale. `locale` takes a locale code as a value (see <ExternalLink to="https://github.com/strapi/strapi/blob/main/packages/plugins/i18n/server/src/constants/iso-locales.json" text="full list of available locales"/>).

:::tip
If the `locale` parameter is not defined, it will be set to the default locale. `en` is the default locale when a new Strapi project is created, but another locale can be [set as the default locale](/cms/features/internationalization#settings) in the admin panel.

For instance, by default, a GET request to `/api/restaurants` will return the same response as a request to `/api/restaurants?locale=en`.
:::

The following table lists the new possible use cases added by i18n to the REST API and gives syntax examples (you can click on requests to jump to the corresponding section with more details):

<Tabs groupId="collection-single">

<TabItem value="collection" label="For collection types">

| Use case | Syntax example<br/>and link for more information |
|---------|-------|
| Get all documents in a specific locale | [`GET /api/restaurants?locale=fr`](#rest-get-all) |
| Get a specific locale version for a document | [`GET /api/restaurants/abcdefghijklmno456?locale=fr`](#get-one-collection-type) |
| Create a new document for the default locale | [`POST /api/restaurants`](#rest-create-default-locale)<br/>+ pass attributes in the request body |
| Create a new document for a specific locale | [`POST /api/restaurants`](#rest-create-specific-locale)<br/>+ pass attributes **and locale** in the request body |
| Create a new, or update an existing, locale version for an existing document | [`PUT /api/restaurants/abcdefghijklmno456?locale=fr`](#rest-put-collection-type)<br/>+ pass attributes in the request body |
| Delete a specific locale version of a document | [`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`](#rest-delete-collection-type) |

</TabItem>

<TabItem value="single" label="For single types">

| Use case                                     | Syntax example<br/>and link for more information |
|----------------------------------------------|--------------------------------------------------|
| Get a specific locale version for a document | [`GET /api/homepage?locale=fr`](#get-one-single-type)  |
| Create a new, or update an existing, locale version for an existing document | [`PUT /api/homepage?locale=fr`](#rest-put-single-type)<br/>+ pass attributes in the request body |
| Delete a specific locale version of a document | [`DELETE /api/homepage?locale=fr`](#rest-delete-single-type) |

</TabItem>
</Tabs>

### `GET` Get all documents in a specific locale {#rest-get-all}

<ApiCall>

<Request> 

`GET http://localhost:1337/api/restaurants?locale=fr`

</Request>

<Response> 

```json
{
  "data": [
    {
      "id": 5,
      "documentId": "h90lgohlzfpjf3bvan72mzll",
      "Title": "Meilleures pizzas",
      "Body": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "On déguste les meilleures pizzas de la ville à la Pizzeria Arrivederci."
            }
          ]
        }
      ],
      "createdAt": "2024-03-06T22:08:59.643Z",
      "updatedAt": "2024-03-06T22:10:21.127Z",
      "publishedAt": "2024-03-06T22:10:21.130Z",
      "locale": "fr"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 1
    }
  }
}
```

</Response>
</ApiCall>

### `GET` Get a document in a specific locale {#rest-get}

To get a specific document in a given locale, add the `locale` parameter to the query:

| Use case             | Syntax format and link for more information                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| In a collection type | [`GET /api/content-type-plural-name/document-id?locale=locale-code`](#get-one-collection-type) |
| In a single type     | [`GET /api/content-type-singular-name?locale=locale-code`](#get-one-single-type)               |

#### Collection types {#get-one-collection-type}

To get a specific document in a collection type in a given locale, add the `locale` parameter to the query, after the `documentId`:

<ApiCall>

<Request>

`GET /api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

</Request>

<Response>

```json
{
  "data": [
    {
      "id": 22,
      "documentId": "lr5wju2og49bf820kj9kz8c3",
      "Name": "Biscotte Restaurant",
      "Description": [
        {
          "type": "paragraph",
          "children": [
            {
              "type": "text",
              "text": "Bienvenue au restaurant Biscotte! Le Restaurant Biscotte propose une cuisine à base de produits frais et de qualité, souvent locaux, biologiques lorsque cela est possible, et toujours produits par des producteurs passionnés."
            }
          ]
        }
      ],
      // …
      "locale": "fr"
    },
    // …
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 3
    }
  }
}
```

</Response>

</ApiCall>

#### Single types {#get-one-single-type}

To get a specific single type document in a given locale, add the `locale` parameter to the query, after the single type name:

<ApiCall>

<Request>

`GET /api/homepage?locale=fr`

</Request>

<Response>

```json
{
  "data": {
    "id": 10,
    "documentId": "ukbpbnu8kbutpn98rsanyi50",
    "Title": "Page d'accueil",
    "Body": null,
    "createdAt": "2024-03-07T13:28:26.349Z",
    "updatedAt": "2024-03-07T13:28:26.349Z",
    "publishedAt": "2024-03-07T13:28:26.353Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

### `POST` Create a new localized document for a collection type {#rest-create}

To create a localized document from scratch, send a POST request to the Content API. Depending on whether you want to create it for the default locale or for another locale, you might need to pass the `locale` parameter in the request's body

| Use case                      | Syntax format and link for more information                                               |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Create for the default locale | [`POST /api/content-type-plural-name`](#rest-create-default-locale) |
| Create for a specific locale  | [`POST /api/content-type-plural-name`](#rest-create-specific-locale)<br/>+ pass locale in request body               |

#### For the default locale {#rest-create-default-locale}

If no locale has been passed in the request body, the document is created using the default locale for the application:

<ApiCall>
<Request> 

`POST http://localhost:1337/api/restaurants`

```json
{
  "data": {
    "Name": "Oplato",
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 13,
    "documentId": "jae8klabhuucbkgfe2xxc5dj",
    "Name": "Oplato",
    "Description": null,
    "createdAt": "2024-03-06T22:19:54.646Z",
    "updatedAt": "2024-03-06T22:19:54.646Z",
    "publishedAt": "2024-03-06T22:19:54.649Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>
</ApiCall>

#### For a specific locale {#rest-create-specific-locale}

To create a localized entry for a locale different from the default one, add the `locale` attribute to the body of the POST request:

<ApiCall>
<Request>

`POST http://localhost:1337/api/restaurants`

```json {4}
{
  "data": {
    "Name": "She's Cake",
    "locale": "fr"
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 15,
    "documentId": "ldcmn698iams5nuaehj69j5o",
    "Name": "She's Cake",
    "Description": null,
    "createdAt": "2024-03-06T22:21:18.373Z",
    "updatedAt": "2024-03-06T22:21:18.373Z",
    "publishedAt": "2024-03-06T22:21:18.378Z",
    "locale": "en"
  },
  "meta": {}
}
```

</Response>
</ApiCall>

### `PUT` Create a new, or update an existing, locale version for an existing document {#rest-update}

With `PUT` requests sent to an existing document, you can:

- create another locale version of the document,
- or update an existing locale version of the document.

Send the `PUT` request to the appropriate URL, adding the `locale=your-locale-code` parameter to the query URL and passing attributes in a `data` object in the request's body:

| Use case             | Syntax format and link for more information                                               |
| -------------------- | --------------------------------------------------------------------------------------- |
| In a collection type | [`PUT /api/content-type-plural-name/document-id?locale=locale-code`](#rest-put-collection-type) |
| In a single type     | [`PUT /api/content-type-singular-name?locale=locale-code`](#rest-put-single-type)               |

:::caution
When creating a localization for existing localized entries, the body of the request can only accept localized fields.
:::

:::tip
The Content-Type should have the [`createLocalization` permission](/cms/features/rbac#collection-and-single-types) enabled, otherwise the request will return a `403: Forbidden` status.
:::

:::note
It is not possible to change the locale of an existing localized entry. When updating a localized entry, if you set a `locale` attribute in the request body it will be ignored.
:::

#### In a collection type {#rest-put-collection-type}

To create a new locale for an existing document in a collection type, add the `locale` parameter to the query, after the `documentId`, and pass data to the request's body:

<ApiCall noSideBySide>

<Request title="Example request: Creating a French locale for an existing restaurant">

`PUT http://localhost:1337/api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

```json
{
  data: {
    "Name": "She's Cake in French",
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 19,
    "documentId": "lr5wju2og49bf820kj9kz8c3",
    "Name": "She's Cake in French",
    "Description": null,
    "createdAt": "2024-03-07T12:13:09.551Z",
    "updatedAt": "2024-03-07T12:13:09.551Z",
    "publishedAt": "2024-03-07T12:13:09.554Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

#### In a single type {#rest-put-single-type}

To create a new locale for an existing single type document, add the `locale` parameter to the query, after the single type name, and pass data to the request's body:

<ApiCall>

<Request title="Example: Create a FR locale for an existing Homepage single type">

`PUT http://localhost:1337/api/homepage?locale=fr`

```json
{
  "data": {
    "Title": "Page d'accueil"
  }
}
```

</Request>

<Response>

```json
{
  "data": {
    "id": 10,
    "documentId": "ukbpbnu8kbutpn98rsanyi50",
    "Title": "Page d'accueil",
    "Body": null,
    "createdAt": "2024-03-07T13:28:26.349Z",
    "updatedAt": "2024-03-07T13:28:26.349Z",
    "publishedAt": "2024-03-07T13:28:26.353Z",
    "locale": "fr"
  },
  "meta": {}
}
```

</Response>

</ApiCall>

<br/>

### `DELETE` Delete a locale version of a document {#rest-delete}

To delete a locale version of a document, send a `DELETE` request with the appropriate `locale` parameter.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

#### In a collection type {#rest-delete-collection-type}

To delete only a specific locale version of a document in a collection type, add the `locale` parameter to the query after the `documentId`:

<Request>

`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`

</Request>

#### In a single type {#rest-delete-single-type}

To delete only a specific locale version of a single type document, add the `locale` parameter to the query after the single type name:

<Request>

`DELETE /api/homepage?locale=fr`

</Request>
---
title: Relations
description: Use the REST API to manage the order of relations
displayed_sidebar: cmsSidebar
sidebar_label: Relations
tags:
- API 
- relations
- Content API
- disconnect
- REST API
---

# Managing relations with API requests

Defining relations between content-types (that are designated as entities in the database layers) is connecting entities with each other.

Relations between content-types can be managed through the [admin panel](/cms/features/content-manager#relational-fields) or through [REST API](/cms/api/rest) or [Document Service API](/cms/api/document-service) requests.

Relations can be connected, disconnected or set through the Content API by passing parameters in the body of the request. These payloads work for both single-entry relations and multi relations (one-to-many, many-to-one, many-to-many, and many-way). When a relational field allows multiple links, the API expects arrays of relation IDs and returns arrays in responses.

|  Parameter name         | Description | Type of update |
|-------------------------|-------------|----------------|
| [`connect`](#connect)   | Connects new entities.<br /><br />Can be used in combination with `disconnect`.<br /><br />Can be used with [positional arguments](#relations-reordering) to define an order for relations.    | Partial |
| [`disconnect`](#disconnect)    | Disconnects entities.<br /><br />Can be used in combination with `connect`. | Partial |
| [`set`](#set)           | Set entities to a specific set. Using `set` will overwrite all existing connections to other entities.<br /><br />Cannot be used in combination with `connect` or `disconnect`.  | Full |

:::note
Multi relations can be managed from the REST API and the [GraphQL API](/cms/api/graphql#fetch-relations): the  `connect`, `disconnect`, and `set` operations are available across both APIs. However, the [Document Service API](/cms/api/document-service) does not handle relations.
:::

:::note
When [Internationalization (i18n)](/cms/features/internationalization) is enabled on the content-type, you can also pass a locale to set relations for a specific locale, as in this Document Service API example:

```js
await strapi.documents('api::restaurant.restaurant').update({ 
  documentId: 'a1b2c3d4e5f6g7h8i9j0klm',
  locale: 'fr',
  data: { 
    category: {
      connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']
    }
  }
})
```

If no locale is passed, the default locale will be assumed.
:::

## `connect`

Using `connect` in the body of a request performs a partial update, connecting the specified relations.

`connect` accepts either a shorthand or a longhand syntax:

| Syntax type | Syntax example |
| ------------|----------------|
| shorthand   | `connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']` |
| longhand    | ```connect: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]``` |

You can also use the longhand syntax to [reorder relations](#relations-reordering).

`connect` can be used in combination with [`disconnect`](#disconnect).

:::caution
`connect` is not officially supported for media attributes. Advanced users can technically connect media entries by targeting upload file IDs, but this workaround isn't recommended or supported by Strapi and can easily break (e.g. when Draft & Publish uses mismatched IDs). Proceed with caution.
:::

<Tabs groupId="shorthand-longhand">

<TabItem value="shorthand" label="Shorthand syntax example">

Sending the following request updates a `restaurant`, identified by its `documnentId` `a1b2c3d4e5f6g7h8i9j0klm`. The request uses the `categories` attribute to connect the restaurant with 2 categories identified by their `documentId`:

<MultiLanguageSwitcher title="Example request using the shorthand syntax">
<MultiLanguageSwitcherRequest language="REST">

`PUT` `http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']
    }
  }
}
```

</MultiLanguageSwitcherRequest>

<MultiLanguageSwitcherRequest language="Node">

```js
const fetch = require('node-fetch');

const response = await fetch(
  'http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm',
  {
    method: 'put',
    body: {
      data: {
        categories: {
          connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']
        }
      }
    }
  }
);
```

</MultiLanguageSwitcherRequest>
</MultiLanguageSwitcher>

</TabItem>

<TabItem value="longhand" label="Longhand syntax example">

Sending the following request updates a `restaurant`, identified by its `documnentId` `a1b2c3d4e5f6g7h8i9j0klm`. The request uses the `categories` attribute to connect the restaurant with 2 categories identified by their `documentId`:

<MultiLanguageSwitcher title="Example request using the longhand syntax">
<MultiLanguageSwitcherRequest language="REST">

`PUT` `http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      connect: [
        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' },
        { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
      ]
    }
  }
}
```

</MultiLanguageSwitcherRequest>

<MultiLanguageSwitcherRequest language="Node">

```js
const fetch = require('node-fetch');

const response = await fetch(
  'http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm',
  {
    method: 'put',
    body: {
      data: {
        categories: {
          connect: [
            { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' },
            { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
          ]
        }
      }
    }
  }
);
```

</MultiLanguageSwitcherRequest>
</MultiLanguageSwitcher>

</TabItem>
</Tabs>

### Relations reordering

<VersionBadge version="4.6.0" />

Positional arguments can be passed to the longhand syntax of `connect` to define the order of relations.

The longhand syntax accepts an array of objects, each object containing the `documentId` of the entry to be connected and an optional `position` object to define where to connect the relation.

:::note Different syntaxes for different relations
The syntaxes described in this documentation are useful for one-to-many, many-to-many and many-ways relations.<br />For one-to-one, many-to-one and one-way relations, the syntaxes are also supported but only the last relation will be used, so it's preferable to use a shorter format (e.g.: `{ data: { category: 'a1b2c3d4e5f6g7h8i9j0klm' } }`, see [REST API documentation](/cms/api/rest#requests)).
:::

To define the `position` for a relation, pass one of the following 4 different positional attributes:

| Parameter name and syntax | Description                                                            | Type       |
| ------------------------- | ---------------------------------------------------------------------- | ---------- |
| `before: documentId`      | Positions the relation before the given `documentId`.                  | `documentId` (string) |
| `after: documentId`       | Positions the relation after the given `documentId`.                   | `documentId` (string) |
| `start: true`             | Positions the relation at the start of the existing list of relations. | Boolean    |
| `end: true`               | Positions the relation at the end of the existing list of relations.   | Boolean    |

The `position` argument is optional and defaults to `position: { end: true }`.

:::note Sequential order
Since `connect` is an array, the order of operations is important as they will be treated sequentially (see combined example below).
:::

:::caution
The same relation should not be connected more than once, otherwise it would return a Validation error by the API.
:::

<Tabs>

<TabItem value="basic" label="Basic example">

Consider the following record in the database:

```js
categories: [
  { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
  { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }
]
```

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, connecting a relation of entity with a `documentId` of `ma12bc34de56fg78hi90jkl` for the `categories` attribute and positioning it before the entity with `documentId` `z0y2x4w6v8u1t3s5r7q9onm`:

<Request title="Example request to update the position of one relation">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      connect: [
        { documentId: 'ma12bc34de56fg78hi90jkl', position: { before: 'z0y2x4w6v8u1t3s5r7q9onm' } },
      ]
    }
  }
}
```

</Request>
</TabItem>

<TabItem value="combined" label="Combined example">

Consider the following record in the database:

```js
categories: [
  { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
  { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }
]
```

Sending the following example in the request body of a PUT request updates multiple relations:

<Request title="Example request to reorder several relations">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      connect: [
        { id: '6u86wkc6x3parjd4emikhmx', position: { after: 'j9k8l7m6n5o4p3q2r1s0tuv'} },
        { id: '3r1wkvyjwv0b9b36s7hzpxl', position: { before: 'z0y2x4w6v8u1t3s5r7q9onm' } },
        { id: 'rkyqa499i84197l29sbmwzl', position: { end: true } },
        { id: 'srkvrr77k96o44d9v6ef1vu' },
        { id: 'nyk7047azdgbtjqhl7btuxw', position: { start: true } },
      ]
    }
  }
}
```

</Request>

Omitting the `position` argument (as in `documentId: 'srkvrr77k96o44d9v6ef1vu9'`) defaults to `position: { end: true }`. All other relations are positioned relative to another existing `id` (using `after` or `before`) or relative to the list of relations (using `start` or `end`). Operations are treated sequentially in the order defined in the `connect` array, so the resulting database record will be the following:

```js
categories: [
  { id: 'nyk7047azdgbtjqhl7btuxw' },
  { id: 'j9k8l7m6n5o4p3q2r1s0tuv' },
  { id: '6u86wkc6x3parjd4emikhmx6' },
  { id: '3r1wkvyjwv0b9b36s7hzpxl7' },
  { id: 'a1b2c3d4e5f6g7h8i9j0klm' },
  { id: 'rkyqa499i84197l29sbmwzl' },
  { id: 'srkvrr77k96o44d9v6ef1vu9' }
]
```

</TabItem>

</Tabs>

### Edge cases: Draft & Publish or i18n disabled

When some built-in features of Strapi 5 are disabled for a content-type, such as [Draft & Publish](/cms/features/draft-and-publish) and [Internationalization (i18)](/cms/features/internationalization), the `connect` parameter might be used differently:

**Relation from a `Category` with i18n _off_ to an `Article` with i18n _on_:**

In this situation you can select which locale you are connecting to:

```js
data: {
    categories: {
      connect: [
        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', locale: 'en' },
        // Connect to the same document id but with a different locale 👇
        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', locale: 'fr' },
      ]
   }
}
```

**Relation from a `Category` with Draft & Publish _off_ to an `Article` with Draft & Publish _on_:**

```js
data: {
  categories: {
    connect: [
      { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', status: 'draft' },
      // Connect to the same document id but with different publication states 👇
      { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', status: 'published' },
    ]
  }
}
```

## `disconnect`

Using `disconnect` in the body of a request performs a partial update, disconnecting the specified relations.

`disconnect` accepts either a shorthand or a longhand syntax:

| Syntax type | Syntax example |
| ------------|----------------|
| shorthand   | `disconnect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']`
| longhand    | ```disconnect: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]``` |

`disconnect` can be used in combination with [`connect`](#connect).

<br />

<Tabs groupId="shorthand-longhand">

<TabItem value="shorthand" label="Shorthand syntax example">

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, disconnecting the relations with 2 entries identified by their `documentId`:

<Request title="Example request using the shorthand syntax">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      disconnect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv'],
    }
  }
}
```

</Request>

</TabItem>

<TabItem value="longhand" label="Longhand syntax example">

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, disconnecting the relations with 2 entries identified by their `documentId`:

<Request title="Example request using the longhand syntax">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      disconnect: [
        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' },
        { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
      ],
    }
  }
}
```

</Request>

</TabItem>
</Tabs>

## `set`

Using `set` performs a full update, replacing all existing relations with the ones specified, in the order specified.

`set` accepts a shorthand or a longhand syntax:

| Syntax type | Syntax example                  |
| ----------- | ------------------------------- |
| shorthand   | `set: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']`                   |
| longhand    | ```set: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]``` |

As `set` replaces all existing relations, it should not be used in combination with other parameters. To perform a partial update, use [`connect`](#connect) and [`disconnect`](#disconnect).

:::note Omitting set
Omitting any parameter is equivalent to using `set`.<br/>For instance, the following 3 syntaxes are all equivalent:

- `data: { categories: set: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }] }}`
- `data: { categories: set: ['z0y2x4w6v8u1t3s5r7q9onm2', 'j9k8l7m6n5o4p3q2r1s0tuv'] }}`
- `data: { categories: ['z0y2x4w6v8u1t3s5r7q9onm2', 'j9k8l7m6n5o4p3q2r1s0tuv'] }`

:::

<Tabs groupId="shorthand-longhand">

<TabItem value="shorthand" label="Shorthand syntax example">

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, replacing all previously existing relations and using the `categories` attribute to connect 2 categories identified by their `documentId`:

<Request title="Example request using the shorthand syntax with set">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      set: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv4'],
    }
  }
}
```

</Request>

</TabItem>

<TabItem value="longhand" label="Longhand syntax example">

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, replacing all previously existing relations and using the `categories` attribute to connect 2 categories identified by their `documentId`:

<Request title="Example request using the longhand syntax with set">

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```js
{
  data: {
    categories: {
      set: [
        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' },
        { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }
      ],
    }
  }
}
```

</Request>

</TabItem>
</Tabs>

<FeedbackPlaceholder />
---
title: Interactive Query Builder
description: Use an interactive tool that leverages the querystring library to build your query URL
displayed_sidebar: cmsSidebar
sidebar_label: Interactive Query Builder
tags:
- Content API
- interactive query builder
- REST API
- qs library
---

# Build your query URL with Strapi's interactive tool

A wide range of parameters can be used and combined to query your content with the [REST API](/cms/api/rest), which can result in long and complex query URLs.

Strapi's codebase uses <ExternalLink to="https://github.com/ljharb/qs" text="the `qs` library"/> to parse and stringify nested JavaScript objects. It's recommended to use `qs` directly to generate complex query URLs instead of creating them manually.

You can use the following interactive query builder tool to generate query URLs automatically:

1. Replace the values in the _Endpoint_ and _Endpoint Query Parameters_ fields with content that fits your needs.
2. Click the **Copy to clipboard** button to copy the automatically generated _Query String URL_ which is updated as you type.

:::info Parameters usage
Please refer to the [REST API parameters table](/cms/api/rest/parameters) and read the corresponding parameters documentation pages to better understand parameters usage.
:::

<br />

<InteractiveQueryBuilder
  endpoint="/api/books"
  code={`
{
  sort: ['title:asc'],
  filters: {
    title: {
      $eq: 'hello',
    },
  },
  populate: {
    author: {
      fields: ['firstName', 'lastName']
    }
  },
  fields: ['title'],
  pagination: {
    pageSize: 10,
    page: 1,
  },
  status: 'published',
  locale: ['en'],
}
  `}
/>

<br />
 
<br />

:::note
The default endpoint path is prefixed with `/api/` and should be kept as-is unless you configured a different API prefix using [the `rest.prefix` API configuration option](/cms/configurations/api).<br/> For instance, to query the `books` collection type using the default API prefix, type `/api/books` in the _Endpoint_ field.
:::

:::caution Disclaimer
The `qs` library and the interactive query builder provided on this page:
- might not detect all syntax errors,
- are not aware of the parameters and values available in a Strapi project,
- and do not provide autocomplete features.

Currently, these tools are only provided to transform the JavaScript object in an inline query string URL. Using the generated query URL does not guarantee that proper results will get returned with your API.
:::
