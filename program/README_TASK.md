# Program Task

Это учебная версия `program/` для студентов.

Что здесь специально изменено:
- В `programs/sol_usd_oracle/src/lib.rs` оставлен `TODO` в логике обновления цены оракула.
- В `programs/token_minter/src/lib.rs` оставлен `TODO` в расчёте комиссии в lamports.
- В `tests/` есть пара намеренно сломанных проверок с пометкой `TODO(student)`.

Как запускать:

```bash
cd program-task
yarn install
anchor build
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
```

Ожидаемый результат в начале:
- проект собирается;
- часть тестов падает;
- студент чинит и Rust-код, и отдельные тесты.
