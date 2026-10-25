import { auditRouting } from "../validation/model.mjs";

export function validate(context) {
  const pkg = JSON.parse(
    context.readOptional(context.model.repoRoot + "/package.json"),
  );
  const source = context.readOptional(
    context.model.repoRoot + "/scripts/validation/lanes.json",
  );
  if (!source)
    return [
      {
        code: "VALIDATION-ROUTING",
        rule: "LPN-SPEC-013",
        file: "scripts/validation/lanes.json",
        line: 1,
        message: "Portable lane registry is missing",
      },
    ];
  return auditRouting(pkg.scripts, JSON.parse(source)).map((message) => ({
    code: "VALIDATION-ROUTING",
    rule: "LPN-SPEC-013",
    file: "package.json",
    line: 1,
    message,
  }));
}
export default { name: "notebookValidationRouting", validate };
