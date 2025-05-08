// DOM
const main = document.getElementById('main');
const outputElement = document.getElementById('output');
const pdf_input = document.getElementById('input');
const preview_container = document.getElementById('preview_container');
const preview_canvas = document.getElementById('preview_canvas');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_preview_wipe = document.getElementById('_c_preview_wipe');
const _c_preview_reset = document.getElementById('_c_preview_reset');
const _c_preview_delete = document.getElementById('_c_preview_delete');
const config_container = document.getElementById('config_container');
const multipage_help = document.getElementById('multipage_help');
const multipage_prev = document.getElementById('multipage_prev');
const multipage_next = document.getElementById('multipage_next');
const multipage_count = document.getElementById('multipage_count');
const action_button_trim = document.getElementById('action_button_trim');
const action_button_split = document.getElementById('action_button_split');

// Global
var filename = "";
var fileBuffer = null;
var PDFDoc = null;
var num_pages = 0;
var renderInProgress = false;

async function renderPDFPage(i)
{
	// Get page
	const page = await PDFDoc.getPage(i);

	// Set up canvases
	const viewport = page.getViewport({scale: CONST_DPI/72});
	canvas.width = viewport.width >= 600 ? 600 : viewport.width;
	canvas.height = viewport.height >= 600 ? 600: viewport.height;
	vCanvas.width = viewport.width;
	vCanvas.height = viewport.height;

	// Render page
	const renderTask = page.render({canvasContext: vContext, viewport});
	await renderTask.promise;
}

// -------------------- OUTPUT -----------------------------

function getLineCount(textarea)
{
    return textarea.value.split('\n').length - 1;
}
function resizeOutput(textarea)
{
	textarea.style.height = "calc(1.2rem * " + getLineCount(textarea) + " + 70px)";
}
function clearOutput(textarea)
{
	textarea.value = "";
}
clearOutput(outputElement);

// ---------------------------------------------------------

// -------------------- CANVAS -----------------------------

// Main canvas
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

// Virtual canvas
const vCanvas = document.createElement('canvas');
const vContext = vCanvas.getContext('2d');
vContext.imageSmoothingEnabled = false;

// Constants
const CONST_DPI = 144;
const CONST_ZOOMFACTOR = 1.1;
const CONST_MOBILEZOOMFACTOR = 1.05;

// Draw, vCanvas into canvas
function draw()
{
	// draw pdf
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(previewWindow.scale, 0, 0, previewWindow.scale, previewWindow.offsetX, previewWindow.offsetY);
	context.drawImage(vCanvas, 0, 0);

	// draw removal
	if(userSelection.pages[userSelection.current - 1] == 0)
	{
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.fillStyle = 'rgba(0, 0, 0, 0.7)';
		context.fillRect(0, 0, canvas.width, canvas.height);
	}
}

// Click
function press(x, y)
{
	const rect = canvas.getBoundingClientRect();
	previewWindow.isDragging = true;
	previewWindow.isTouchZooming = false;
	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;
}

// Move
function move(x, y)
{
	if(!previewWindow.isDragging || previewWindow.isTouchZooming) return;
	const rect = canvas.getBoundingClientRect();

	const dx = x - rect.left - previewWindow.lastX;
	const dy = y - rect.top - previewWindow.lastY;

	previewWindow.offsetX += dx;
	previewWindow.offsetY += dy;

	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;

	draw();
}

// Zoom
function zoom(e)
{
	const rect = canvas.getBoundingClientRect();

	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	const scaleFactor = e.deltaY <= 0 ? CONST_ZOOMFACTOR : 1 / CONST_ZOOMFACTOR;

	const worldX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (mouseY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = mouseX - worldX * previewWindow.scale;
	previewWindow.offsetY = mouseY - worldY * previewWindow.scale;

	draw();
}

// End
function end()
{
	previewWindow.isDragging = false;
	canvas.classList.remove('grabbing');
}

// Mobile
function getTouchesDist(touch1, touch2)
{
	const dx = touch1.clientX - touch2.clientX;
	const dy = touch1.clientY - touch2.clientY;
	return Math.hypot(dx, dy);
}
function getTouchesX(touch1, touch2)
{
	return (touch1.clientX + touch2.clientX)/2;
}
function getTouchesY(touch1, touch2)
{
	return (touch1.clientY + touch2.clientY)/2;
}
function mobileStartZoom(touch1, touch2)
{
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = true;
	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);
}
function mobileZoom(touch1, touch2)
{
	const rect = canvas.getBoundingClientRect();

	const touchX = getTouchesX(touch1, touch2) - rect.left;
	const touchY = getTouchesY(touch1, touch2) - rect.top;
	const scaleFactor = getTouchesDist(touch1, touch2) - previewWindow.lastTouchesDist <= 0 ? 1 / CONST_MOBILEZOOMFACTOR : CONST_MOBILEZOOMFACTOR;

	const worldX = (touchX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (touchY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = touchX - worldX * previewWindow.scale;
	previewWindow.offsetY = touchY - worldY * previewWindow.scale;

	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);

	draw();
}
function mobileEnd()
{
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = false;
}

// ---------------------------------------------------------

// -------------------- PREVIEW ----------------------------

// Preview window stuff
var previewWindow =
{
	scale: 1,
	lastTouchesDist: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	isTouchZooming: false,
};

// Resets preview
function resetPreviewWindow()
{
	previewWindow =
	{
		scale: 1,
		lastTouchesDist: 0,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		isDragging: false,
		isTouchZooming: false,
	};
}

// ---------------------------------------------------------

// -------------------- SPLITTING --------------------------

// Store user selection
var userSelection = 
{
	current: 1,
	total: 1,
	pages: [0,],
};

// Resets user selection
function resetUserSelection(len)
{
	userSelection = 
	{
		current: 1,
		total: len,
		pages: Array.from({length: len}, () => (1)),
	};
}

// ---------------------------------------------------------

// Main logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
pdf_input.onchange = async (e) =>
{
	// Disable UI (reset)
	clearOutput(outputElement);
	config_container.classList.add('hidden');
	multipage_help.classList.add('hidden');

	// Get file
    const file = e.target.files[0];
	if (!file) return;

	// Store filename
	filename = file.name.replace(/\.pdf$/i, '');

	// Get and copy file buffer
	const arrBuffer = await file.arrayBuffer();
	fileBuffer = arrBuffer.slice(0);

	// Load pdf
	PDFDoc = await pdfjsLib.getDocument({data: arrBuffer}).promise;

	// Render 1st page
	renderInProgress = true;
	await renderPDFPage(1);
	renderInProgress = false;

	// Reset preview window
	resetPreviewWindow();

	// Initialize user selection
	num_pages = PDFDoc.numPages;
	resetUserSelection(num_pages);

	// Draw
	draw();

	// Enable UI
	config_container.classList.remove('hidden');
	if(num_pages > 1)
	{
		multipage_help.classList.remove('hidden');
		multipage_count.innerHTML = userSelection.current + '/' + userSelection.total;
	}
}

// -------------------- EVENT LISTENERS --------------------

// -------------------- CANVAS LISTENERS -------------------

// -------------------- PC IMPLEMENTATION ------------------
canvas.addEventListener('wheel', (e)=>
{
	e.preventDefault();
	zoom(e);
});
canvas.addEventListener('mousedown', (e)=>
{
	canvas.classList.add('grabbing');
	press(e.clientX, e.clientY);
});
canvas.addEventListener('mousemove', (e)=>
{
	e.preventDefault();
	move(e.clientX, e.clientY);
});
canvas.addEventListener('mouseup', ()=>
{
	end();
});
canvas.addEventListener('mouseleave', ()=>
{
	end();
});

// -------------------- MOBILE IMPLEMENTATION --------------
canvas.addEventListener('touchstart', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		press(e.touches[0].clientX, e.touches[0].clientY);
	}
	else if(e.touches.length == 2)
	{
		mobileStartZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchmove', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		move(e.touches[0].clientX, e.touches[0].clientY);
	}
	else if(e.touches.length == 2)
	{
		mobileZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchend', ()=>
{
	mobileEnd();
}, {passive: false});
canvas.addEventListener('touchcancel', ()=>
{
	mobileEnd();
}, {passive: false});

// ---------------------------------------------------------

// -------------------- OTHER LISTENERS --------------------

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Wipe all pages
_c_preview_wipe.addEventListener('click', ()=>
{
	// Mark all pages for deletion
	for(let i = 1; i <= num_pages; i++)
	{
		userSelection.pages[i - 1] = 0;
	}

	draw();
})

// Reset selection
_c_preview_reset.addEventListener('click', ()=>
{
	// Mark all pages for keep
	for(let i = 1; i <= num_pages; i++)
	{
		userSelection.pages[i - 1] = 1;
	}

	draw();
})

// Remove current page
_c_preview_delete.addEventListener('click', ()=>
{
	userSelection.pages[userSelection.current - 1] = userSelection.pages[userSelection.current - 1] == 0 ? 1 : 0;

	draw();
})

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Multipage previous page
multipage_prev.addEventListener('click', async function()
{
	if(userSelection.current != 1 && !renderInProgress)
	{
		renderInProgress = true;
		userSelection.current -= 1;
		await renderPDFPage(userSelection.current);
		draw();
		multipage_count.innerHTML = userSelection.current + '/' + userSelection.total;
		renderInProgress = false;
	}
});

// Multipage next page
multipage_next.addEventListener('click', async function()
{
	if(userSelection.current != userSelection.total && !renderInProgress)
	{
		renderInProgress = true;
		userSelection.current += 1;
		await renderPDFPage(userSelection.current);
		draw();
		multipage_count.innerHTML = userSelection.current + '/' + userSelection.total;
		renderInProgress = false;
	}
});

function action(split)
{
	clearOutput(outputElement);
	resizeOutput(outputElement);

	(async() =>{
		// Load PDF
		const {PDFDocument} = PDFLib;
		const pdfDoc = await PDFDocument.load(fileBuffer);

		// Loop through all pages and delete
		for(let i = num_pages; i >= 1; i--)
		{
			// Delete
			if(userSelection.pages[i - 1] == 0)
			{
				pdfDoc.removePage(i - 1);
			}
		}

		// Split to single pages
		if(split == true)
		{
			const num = pdfDoc.getPageCount();
			if(num == 0)
			{
				outputElement.value += "Aborting download of zero pages\n";
				resizeOutput(outputElement);
				return;
			}
			for (let i = 1; i <= num; i++)
			{
				const singlePage = await PDFDocument.create();
				const [copy] = await singlePage.copyPages(pdfDoc, [i - 1]);
				singlePage.addPage(copy);
		
				// Make blob
				const pageBytes = await singlePage.save();
				const blob = new Blob([pageBytes], {type: 'application/pdf'});
				const link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = filename + `-page-${i}` + '.pdf';
				link.click();
				URL.revokeObjectURL(link.href);
			}

		}
		// Trim into one pdf
		else
		{
			const num = pdfDoc.getPageCount();
			if(num == 0)
			{
				outputElement.value += "Aborting download of zero pages\n";
				resizeOutput(outputElement);
				return;
			}
			else if(num == userSelection.total)
			{
				outputElement.value += "Aborting download of unchanged document\n";
				resizeOutput(outputElement);
				return;
			}

			newBytes = await pdfDoc.save();

			// Make bob
			const bob = new Blob([newBytes], {type: 'application/pdf'});
			const link = document.createElement('a');
			link.href = URL.createObjectURL(bob);
			link.download = filename + '-trimmed' + '.pdf';
			link.click();
			URL.revokeObjectURL(link.href);
		}
	})();
}

// Trim
action_button_trim.addEventListener('click', function()
{
	action(false);
});

// False
action_button_split.addEventListener('click', function()
{
	action(true);
});