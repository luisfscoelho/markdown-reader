// GitHub-style heading anchors and the table of contents sidebar.
MDR.slugify = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");

// Gives every heading a unique id and returns the headings in document order.
MDR.anchorHeadings = (container) => {
  const seen = new Map();
  const headings = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];

  for (const heading of headings) {
    const slug = MDR.slugify(heading.textContent) || "section";
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    heading.id = count ? `${slug}-${count}` : slug;
  }
  return headings;
};

MDR.buildToc = (nav, headings) => {
  const links = headings.map((heading) => {
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = heading.textContent;
    link.className = `mdr-toc-${heading.tagName.toLowerCase()}`;
    return link;
  });
  nav.replaceChildren(...links);

  MDR.tocEntries = headings.map((heading, i) => ({ heading, link: links[i] }));
  MDR.updateToc();
};

// Highlights the last heading that has scrolled past the top of the viewport.
MDR.updateToc = () => {
  let active = null;
  for (const entry of MDR.tocEntries || []) {
    entry.link.classList.remove("mdr-active");
    if (entry.heading.getBoundingClientRect().top <= 80) active = entry;
  }
  active?.link.classList.add("mdr-active");
};
