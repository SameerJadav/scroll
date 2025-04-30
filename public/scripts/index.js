async function main() {
  try {
    await fetch("/api/notes");
    // await fetch("/api/notes", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ title: "Foo", content: "foo bar baz" }),
    // });
  } catch (error) {}
}

main();
