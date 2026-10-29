# AI usage

This file lists the AI tool I used, the prompts I sent, who made each decision, and how the result was checked. Dates and times are Bogotá time (UTC-5), 28-29 October 2026.

## Summary

I used **Claude** (Anthropic) as my only AI tool for this exercise. I used it for all of it: understanding the statement, choosing the approach, and writing the source code, tests, fixtures, Postman collection, README and design note. **Most of the code and text in this repository was written by Claude** in working sessions with me. My part was to choose the direction, give the requirements, create the project folder, run the project on my own machine and check the results.

## AI tool used

| Tool | How I used it |
|---|---|
| Claude (Anthropic), Sonnet 5.5, in the Claude app | Chat to understand the statement and plan the work. File and shell tools to write the project, run the tests and start the server. Access to my project folder, so the files were saved there. One web search (prompt 7). |

No other AI tool was used.

## Where the work happened

- **Conversation A**: the conversation where I first shared the assessment. Earlier, unrelated content in it is not included here.
- **Conversation B** ("Desarrollo de technical assessment"): the project was built here, in four phases: (1) domain, (2) provider, fixtures, storage and service, (3) HTTP layer, (4) Postman collection, README, design note and a first draft of this file.

## What was made with AI

| Part | Made by |
|---|---|
| `src/`, `fixtures/`, `tests/`, config files | Written by Claude. I ran them on my machine (see Verification). |
| `README.md`, `DESIGN_NOTE.md` | Written by Claude, in English to match the statement. |
| `postman/` | Created with Claude (next section). |
| `AI_USAGE.md` | First drafted by Claude on 28 Oct. This version was completed on 29 Oct from the real conversation history. |

## Postman collection (`postman/`)

I used Claude to create the `postman/` folder. After running `npm test` and `npm start` I asked which examples I should try in Postman, because I did not know which ones (prompt 6). Claude generated `postman/building-systems-estimator.postman_collection.json`, a Postman v2.1 collection that can be imported directly (Postman: Import, then select the file). It needs the server running on `http://localhost:3000`; the address is the `baseUrl` collection variable and can be edited.

- **8 requests, in order:** demo (201), read the saved estimate (200), `verification_failure` (201), `initial_failure` (502), empty project and 0 floors (400), floors sent as a string (400), unknown fixture (400), unknown id (404).
- **Tests inside each request:** 27 assertions in total, checking the status code and the key values (total 8680, selected 28/6, warnings, `null` verification scan, error codes). Request 1 saves the new id in the `estimateId` variable so request 2 can read it back.
- **How it was made and checked:** Claude generated the JSON with a throwaway Node script that is not part of this repository, then ran the collection with newman (Postman's command-line runner) against the real server. It was run again on 29 Oct (see Verification).

## Prompts

My prompts were written in Spanish. The English text is a translation; the original is in the collapsed block under each one. Pasted terminal output is omitted because it contained my Windows username and file paths. Claude's answers are summarized, not copied.

### 1. 28 Oct, 17:50, Conversation A: receiving the assessment

I attached the assessment PDF and the hiring contact's email (omitted), and wrote:

> [...] For this technical assessment I can use tools to help me complete it, and in this case I will use Claude, so I would like you to look at it, analyze it and explain to me how to develop the assessment, point by point, so that I am the one who makes the development decisions. The explanation must be clear, without very technical language.
>
> The idea of the exercise is not only to do the assessment but also to learn new technical skills.

<details>
<summary>Original (Spanish)</summary>

> [...] Para esta prueba técnica puedo hacer uso de las herramientas de las que me vaya apoyar para poder completarlo y pues en este caso voy a hacer uso de Claude, así que, me gustaría que vieras, analizaras y me explicarás como debo desarrollar la prueba, punto por punto, para que sea yo quien tome las decisiones del desarrollo, la explicación debe ser clara, sin la necesidad de tener que usar un lenguaje técnico demasiado alto.
>
> La idea del ejercicio no es solo hacer la prueba técnica, sino también aprender y nuevas habilidades técnicas

</details>

**Claude:** read the PDF and answered with a 9-step route (tools, fixtures, provider interface, pure rules, validation, flow and endpoints, tests, design note, README/AI_USAGE/hours). It proposed that it would explain each step and its options while I decide. No code was written in this message.

### 2. 28 Oct, 21:35, Conversation B: checking my understanding, stack and architecture

> I need you to help me review the development of this technical assessment. It is an opportunity in which they can evaluate my different skills, but beyond that I want to understand well what the assessment is about and how the API behind it works.
>
> The assessment has 11 points in total. As far as I understand, it is about making a small API that:
>
> - Scans a building twice, in a simulated way.
> - Compares the results.
> - Chooses quantities with a fixed rule.
> - Calculates the price and saves it.
>
> Since I am not sure whether I understand correctly what the assessment is about, can you confirm whether what I am telling you is right or whether something is missing?
>
> It is not something too difficult, but I suppose what they will evaluate is order, clarity and that I manage to understand the code, because they may ask me to explain it or make a change live.
>
> For the development tools I was thinking of TypeScript plus Express, which is what I have been using for the last two months at university. As for the database, I don't know which one to use, MySQL, SQLite or PostgreSQL, because the data has to survive a restart.
>
> We also have to evaluate what kind of architecture is good practice for developing this assessment.
>
> I would like to know what you think about the assessment, and for you to recommend how to develop it or how I could do it, considering that it has a set time of 4 to 6 hours.

<details>
<summary>Original (Spanish)</summary>

> Necesito que me ayudes a revisar el desarrollo de esta technical assessment. Es una oportunidad en la que pueden evaluar mis diferentes habilidades, pero más allá de eso quiero entender bien de qué trata la prueba y cómo funciona el API detrás.
>
> Dentro de la prueba hay 11 puntos en total. Según lo que tengo entendido, es hacer una API pequeña que:
>
> • Escanea un edificio dos veces de manera simulada.
> • Compara los resultados.
> • Elige cantidades con una regla fija.
> • Calcula el precio y lo guarda.
>
> Como no estoy seguro de si estoy entiendo bien sobre lo que trata la prueba me puedes confirmar si lo que te estoy diciendo esta bien o si por lo contrario hace falta algo.
>
> No es algo demasiado difícil, pero supongo que lo que van a evaluar es el orden, la claridad y que logre entender el código, porque a lo mejor me piden explicarlo o hacer algún cambio en vivo.
>
> Para las herramientas de desarrollo estaba pensando en TypeScript más Express, que es lo que estuve manejando en los últimos dos meses en la universidad. En cuanto a base de datos, no sé cual usar, si MySQL, SQLite o PostgreSQL, porque los datos tienen que sobrevivir a un reinicio.
>
> También hay que evalular que tipo de arquitectura es una buena practica para el desarrollo de esta prueba.
>
> Me gustaría saber qué piensas tú respecto a la prueba y que me recomiendes cómo desarrollarla o cómo la podría hacer, considerando que tiene un tiempo establecido de 4 a 6 horas para hacerla.

</details>

**Claude:** confirmed the flow and corrected two points (the scan is simulated from fixtures, and the initial scan always wins, it is not "chosen"). It listed what was missing: provider abstraction, failure handling, validation, tests including a restart test, and the deliverables. It recommended TypeScript + Express with zod and vitest + supertest, SQLite with a single table and JSON columns (comparing it with PostgreSQL and MySQL), a light ports-and-adapters layout, and an hour-by-hour plan for the 4-6 hours.

### 3. 28 Oct, 22:03, Conversation B: confirming the stack and the way of working

> Perfect, so we are going to use TypeScript + Express 5, and also add zod and vitest + supertest for the tests. Additionally, we are going to use SQLite, so we don't have to install anything, and also because it gives us a single file, and as you told me it persists across a restart and we can also run the tests.
>
> What we are going to do is the following: you will help me do the whole assessment, from start to end, that is, we will do it both of us, but I will be verifying everything you do. So let's start the development of this assessment.

<details>
<summary>Original (Spanish)</summary>

> Perfecto, entonces vamos a usar TypeScript + Express 5, y además, vamos a añadir zod y vitest + supertest para realizar los test. Adicional, vamos a usar SQLite, para no tener que hacer instalación, y asimismo que nos permita tener un solo archivo, y pues como tu me lo dijiste este persiste al reiniciar y también podemos hacer los tests.
>
> Lo que vamos a hacer es lo siguiente, me vas a ayudar a hacer toda la prueba, desde el principio hasta el final, es decir que, lo vamos a hacer los dos, pero yo voy a ir verificando todo lo que tu hagas. Así que empecemos con el desarrollo de esta prueba.

</details>

**Claude:** phase 1. It created the project (TypeScript, Express 5, zod, `better-sqlite3`, vitest, supertest) and wrote the domain as pure functions (`pricing.ts`, `consolidation.ts`, `types.ts`) with their tests, and explained its decisions.

### 4. 28 Oct, 22:18, Conversation B: project folder

> Yes, of course. What you can do is, I created a folder on my computer called "technical_assessment". Inside it you can save all the development as it goes, and you can also run the tests locally to verify that everything is working correctly.
>
> So I think we can continue with the next phase.

<details>
<summary>Original (Spanish)</summary>

> Sí, claro, por supuesto. Lo que puedes hacer es que yo creé una carpeta en mi ordenador llamada "technical_assessment". Dentro de esta puedes ir guardando todo el desarrollo que se vaya haciendo, y asimismo también puedes ir haciendo las pruebas de manera local, para verificar que todo esta funcionando correctamente.
>
> Entonces, yo creo que podemos continuar con la siguiente fase.

</details>

**Claude:** connected to my folder and built phase 2: the `ScanProvider` and `EstimateRepository` interfaces, `MockScanProvider`, the three fixtures, the SQLite repository and the three-stage `EstimateService`, with tests. It saved the project in my folder.

### 5. 28 Oct, 22:29, Conversation B: first run on my machine

> Done, I already ran the two commands you told me: npm install and npm test. Apparently both worked correctly.
>
> I think you can now check the result of both, review the current state of the project, and we could move on to the next phase.
>
> [terminal output omitted: `npm install` without errors and 71 tests passing in 6 files]

<details>
<summary>Original (Spanish)</summary>

> Listo, ya corrí los dos comandos que me indicaste: npm install y npm test. Al parecer los dos funcionaron correctamente.
>
> Yo creo que puedes revisar en este momento cuál fue el resultado de ambos comandos, revisar el estado actual del proyecto y podríamos avanzar con la siguiente fase.
>
> [salida de la terminal omitida: `npm install` sin errores y 71 tests pasando en 6 archivos]

</details>

**Claude:** compared my folder with its own copy and built phase 3: validation with zod, routes, the error handler (one place that turns each error into an HTTP status), `createApp`, config and `server.ts`, and the HTTP integration tests (142 tests in total).

### 6. 28 Oct, 22:41, Conversation B: Postman and PowerShell

> I already ran the commands npm test and npm start.
>
> You tell me to try the examples with Postman, but I don't know which ones, so I would need you to tell me which ones so I can try them.
>
> You also mentioned something about PowerShell regarding the curl command, but I didn't understand that very well either. I think that while you explain that to me, you can do the next phase.
>
> [terminal output omitted: 142 tests passing in 9 files and the server listening on port 3000]

<details>
<summary>Original (Spanish)</summary>

> Ya corrí los comandos npm test y npm start.
>
> Me dices que pruebe los ejemplos con Postman, pero no sé cuáles son, así que necesitaría que me indiques cuáles para poder probarlos.
>
> También me mencionaste algo de PowerShell respecto al comando curl, pero tampoco lo entendí muy bien. Creo que mientras me explicas eso, puedes ir haciendo la siguiente fase.
>
> [salida de la terminal omitida: 142 tests pasando en 9 archivos y el servidor escuchando en el puerto 3000]

</details>

**Claude:** phase 4. It generated the **Postman collection** (see the section above), ran it with newman, and wrote `README.md`, `DESIGN_NOTE.md` (253 words, limit 300) and a first draft of this file. It copied them to my folder and compared checksums. It explained which examples to try in Postman, and why `curl` fails in Windows PowerShell (`curl` is an alias of `Invoke-WebRequest`; alternatives: `Invoke-RestMethod`, `curl.exe`, or Postman).

### 7. 29 Oct, 06:22, Conversation A: stack, architecture and a search for the exercise

> I have already been looking a bit into the stack I want to use, so I decided to use TypeScript + Express 5, and I will also add zod and vitest + supertest for the tests. Additionally, I will use SQLite, mostly because it gives a single file, because it persists across a restart, and because I will also be able to run the tests.
>
> I also chose a layered architecture, but "light", with ports and adapters. However, before going on I would like to know whether this "exercise" has been used before or is published somewhere, such as GitHub or Stack Overflow. I ask mostly because I want to see how it was developed by other people. If the same exercise is not there, no problem.

<details>
<summary>Original (Spanish)</summary>

> Ya he estado averiguando un poco sobre el stack que quiero usar, entonce tomé la decisión de usar TypeScript + Express 5, y además, voy a añadir zod y vitest + supertest para realizar los distintos test. Adicional, voy a utilizar SQLite, ,ás que nada para que permita tener un solo archivo, y porque este persiste al realizar un reinicio y también voy a poder a hacer los tests.
>
> También escogí una arquitectura en capas, pero que es entre comillas ligera, con puertos y adaptadores. Sin embargo, antes de proseguir me gustaría saber si este "ejercicio" ya ha sido utilizado anteriormente o si esta publicado en algun sitio, como GitHub o Stack Overflow. Lo pregunto más que nada porque me quiero ver como fue desarrollado por otras personas. En caso de que no este el mismo ejercicio no hay problema.

</details>

**Claude:** ran four web searches (the distinctive names in the statement, the fixture names, the endpoint, the hiring context) and found nothing related: only unrelated results. It said the search is not exhaustive and offered to look for public projects in the same style (Express + SQLite + ports and adapters) as learning examples, not for this exercise. Nothing from the search was used in this project.

### 8. 29 Oct, 10:46, Conversation A: analysis and completing this file

> I need you to help me analyze the assessment, with the stack that was used to complete the challenge, and also the architecture that was used.
>
> I also need you to help me complete the "AI_USAGE.md" file with all the prompts I used, specifying that I also used Claude to create the /postman folder, which contains a .JSON file that can be imported directly into Postman to test the API.

<details>
<summary>Original (Spanish)</summary>

> Necesito que me ayudes a analizar la prueba del test, con el stack que se utilizo para completar el reto, y también la arquitectura que se utilizo.
>
> También necestio que me ayudes a completar el archivo de "AI_USAGE.MD", con todos lo prompts que utilice y especificando que también utilice la herramienta de Claude para crear la caperta /postman, el cual contiene un archivo .JSON que se puede importar directamente en Postman para realizar las pruebas de la API

</details>

**Claude:** re-read the assessment PDF and compared every requirement with the code and the tests (all covered). It re-ran the checks listed in Verification, recovered my earlier prompts from the Conversation B history, and wrote this file.

## Decisions: who decided what

| Decision | Made by | Notes |
|---|---|---|
| TypeScript + Express | Me | The tools I already used at university (prompt 2). |
| Express 5, zod, vitest + supertest | Claude suggested, I accepted | I also looked into the stack myself before confirming it (prompts 3 and 7). |
| SQLite, through `better-sqlite3` | Claude recommended, I accepted | Compared with PostgreSQL and MySQL. Chosen because it needs no installation, is one file, persists across restarts and is easy to test. |
| Light ports-and-adapters layering, pure domain functions | Claude proposed, I adopted it | Business rules do not depend on HTTP, SQLite or files, so they are easy to test and to change (prompts 2 and 7). |
| Provider interface with `listFixtures()` and `scan()` | Claude, while implementing | `listFixtures()` lets the unknown-fixture error list the available fixtures. |
| Status `completed` / `completed_with_warnings`; `scans.verification` is `null` when that scan fails | Claude proposed | Documented in the README. |
| `502` for a provider failure, `400` for invalid input and unknown fixture, one JSON error format | Claude proposed | Client mistakes are 4xx and provider failures are 5xx, so they can be told apart. |
| Upper limits (`floors` at most 1000, `project` at most 200 characters) | Claude | Not in the statement; the README says so. They keep totals exact integers. |
| Ids as `est_` plus a UUID | Claude | The statement allows any consistent format. |

I did not ask for changes to any of these decisions during the sessions.

## Verification

- **Automated tests.** 142 tests in 9 files. On my Windows machine I ran `npm install`, `npm test` (71 passing after phase 2, 142 after phase 3) and `npm start` myself (prompts 5 and 6).
- **Clean re-check on 29 Oct.** Claude ran the project again from a clean copy of my folder (no `node_modules`, no database file), on Linux with Node 22: `tsc --noEmit` without errors, 142 of 142 tests passing, and `npm run build` compiles.
- **Real server, compiled build.** Claude started the compiled server and sent the statement's examples with curl: demo gave 201 with total 8680, selected 28/6 and the warning `Antenna count mismatch: 28 vs 26`; the saved estimate was read back with 200; `verification_failure` gave 201 with a `null` verification scan and the warning `Verification scan failed`; `initial_failure` gave 502; empty project and 0 floors gave 400; an unknown fixture gave 400; an unknown id gave 404.
- **Nothing saved on failure.** After those calls the SQLite file had exactly 2 rows (demo and `verification_failure`). The failure tests in `tests/api.test.ts` also count rows through a separate database connection.
- **Restart.** The server process was stopped and a new one started on the same database file; `GET` returned an estimate identical to the one created before the restart. The test suite also simulates this (closes the database and builds a new repository, service and app over the same file).
- **Postman collection.** Run with newman against the real server, on 28 Oct and again on 29 Oct: 8 requests, 27 assertions, 0 failures.
- **Files copied to my folder** were compared by checksum with Claude's copy (28 Oct).

## What was not verified, and limits

- The PowerShell example in the README was not run by Claude (its environment has no PowerShell).
- Claude's own runs were on Linux. On Windows, only what I ran myself is verified (`npm install`, `npm test`, `npm start`).
- In Claude's Linux sandbox `npm install` had to compile `better-sqlite3` from source and could only do so by pointing to the local Node headers, because it could not download them. It worked on my Windows machine. The README's troubleshooting section covers the install-script warning.
- The restart test inside the suite is a simulation in one process; the two-process restart was checked with the manual procedure above, not by an automated test.

## Transcripts

Full conversation exports are not attached to this repository. The prompts above are quoted as I sent them (originals in Spanish in the collapsed blocks); Claude's answers are summarized. Pasted terminal output and anything unrelated to this exercise were left out.
