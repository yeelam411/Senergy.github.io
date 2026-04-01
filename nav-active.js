(() => {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const styleId = 'senergy-nav-active-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            nav a.nav-active {
                background-color: rgba(255, 255, 255, 0.22);
                color: #fff7e8;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
            }
        `;
        document.head.appendChild(style);
    }

    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || 'index.html';
    const links = Array.from(nav.querySelectorAll('a[href]'));

    const normalizeHref = (href) => {
        const clean = href.split('#')[0].split('?')[0];
        const filename = clean.split('/').pop();
        return filename || '';
    };

    const isSubfolderIndex =
        currentFile.toLowerCase() === 'index.html' && /\/[^/]+\/index\.html$/i.test(currentPath);

    let preferredFile = currentFile;
    if (isSubfolderIndex && /stories/i.test(currentPath)) {
        preferredFile = 'stories.html';
    }

    const targetLink = links.find((link) => normalizeHref(link.getAttribute('href') || '') === preferredFile);
    if (!targetLink) return;

    links.forEach((link) => {
        link.classList.remove('nav-active');
        link.removeAttribute('aria-current');
    });

    targetLink.classList.add('nav-active');
    targetLink.setAttribute('aria-current', 'page');
})();
