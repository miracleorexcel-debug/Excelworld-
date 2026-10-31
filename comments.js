import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, addDoc, query, where, limit,
    onSnapshot, doc, setDoc, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 1. PASTE YOUR FIREBASE CONFIG HERE (Firebase console > Project settings > Your apps) */
const firebaseConfig = {
    apiKey: "AIzaSyBEHmyoklhRZGrEH3e0aP_KJ1TQYNHmdz8",
    authDomain: "excelworld-88990.firebaseapp.com",
    projectId: "excelworld-88990",
    appId: "1:1059439862589:web:cbde9e0240b966db499b54"
};

const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
};

function fail(msg) {
    let bar = document.getElementById("comments-error");
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "comments-error";
        bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;padding:12px;background:#b00020;color:#fff;font:14px sans-serif;z-index:2000";
        document.body.append(bar);
    }
    bar.textContent = "Comments error: " + msg;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const time = c => c.createdAt?.toMillis?.() ?? Date.now();

function setup(article, db) {
    const id = slug(article.querySelector(".poem-title").textContent);

    const box = document.createElement("div");
    box.className = "engage";
    box.innerHTML = `
        <button class="like-btn" type="button" aria-pressed="false">
            <span class="heart" aria-hidden="true">♡</span>
            <span class="like-count">0</span>
            <span class="sr-only">likes</span>
        </button>
        <details class="comments">
            <summary>Comments (<span class="comment-count">0</span>)</summary>
            <form class="comment-form">
                <input name="name" maxlength="40" placeholder="Your name" autocomplete="nickname" required>
                <textarea name="text" maxlength="500" rows="3" placeholder="Write a comment" required></textarea>
                <button type="submit">Post comment</button>
                <p class="form-note" role="status"></p>
            </form>
            <ul class="comment-list"></ul>
        </details>`;
    article.append(box);

    const likeBtn = box.querySelector(".like-btn");
    const heart = box.querySelector(".heart");
    const likeCount = box.querySelector(".like-count");
    const form = box.querySelector(".comment-form");
    const note = box.querySelector(".form-note");
    const list = box.querySelector(".comment-list");
    const commentCount = box.querySelector(".comment-count");

    /* Likes */
    const likeRef = doc(db, "likes", id);
    const likeKey = "liked:" + id;
    let liked = store.get(likeKey) === "1";

    const paint = () => {
        likeBtn.setAttribute("aria-pressed", liked);
        likeBtn.classList.toggle("liked", liked);
        heart.textContent = liked ? "♥" : "♡";
    };
    paint();

    onSnapshot(likeRef, snap => {
        likeCount.textContent = snap.exists() ? Math.max(0, snap.data().count) : 0;
    }, err => fail(err.code || err.message));

    likeBtn.addEventListener("click", async () => {
        const next = !liked;
        liked = next;
        store.set(likeKey, next ? "1" : "0");
        paint();
        try {
            await setDoc(likeRef, { count: increment(next ? 1 : -1) }, { merge: true });
        } catch {
            liked = !next;
            store.set(likeKey, liked ? "1" : "0");
            paint();
        }
    });

    /* Comments */
    onSnapshot(
        query(collection(db, "comments"), where("poemId", "==", id), limit(100)),
        snap => {
            const items = snap.docs.map(d => d.data()).sort((a, b) => time(b) - time(a));
            commentCount.textContent = items.length;
            list.replaceChildren(...items.map(c => {
                const li = document.createElement("li");
                const who = document.createElement("strong");
                const when = document.createElement("time");
                const body = document.createElement("p");
                who.textContent = c.name;
                when.textContent = new Date(time(c)).toLocaleDateString();
                body.textContent = c.text;
                li.append(who, when, body);
                return li;
            }));
        },
        err => fail(err.code || err.message)
    );

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const last = Number(store.get("lastComment") || 0);
        if (Date.now() - last < 20000) {
            note.textContent = "Please wait a few seconds before posting again.";
            return;
        }
        const name = form.name.value.trim().slice(0, 40);
        const text = form.text.value.trim().slice(0, 500);
        if (!name || !text) return;

        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        try {
            await addDoc(collection(db, "comments"), {
                poemId: id, name, text, createdAt: serverTimestamp()
            });
            store.set("lastComment", String(Date.now()));
            form.text.value = "";
            note.textContent = "Comment posted.";
        } catch (err) {
            note.textContent = "Could not post (" + (err.code || "error") + "). Check your connection and try again.";
        }
        submit.disabled = false;
    });
}

/* Start everything (kept at the bottom so all helpers exist first) */
if (!firebaseConfig.apiKey.startsWith("PASTE")) {
    const db = getFirestore(initializeApp(firebaseConfig));
    const articles = document.querySelectorAll(".poem-island");
    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries, obs) => {
            entries.forEach(e => {
                if (e.isIntersecting) { obs.unobserve(e.target); setup(e.target, db); }
            });
        }, { rootMargin: "600px 0px" });
        articles.forEach(a => io.observe(a));
    } else {
        articles.forEach(a => setup(a, db));
    }
} else {
    console.warn("comments.js: add your Firebase config to turn on likes and comments.");
}
    
