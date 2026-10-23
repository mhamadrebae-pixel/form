function yesClicked() {
    // دەسکاری قەبارەی فۆنتی دوگمەی بەڵێ دەکەین
    const yesButton = document.querySelector('.btn-yes');
    yesButton.classList.add('expanded'); // کڵاسی 'expanded' زیاد دەکەین تاوەکو فۆنتەکە گەورەتر بێت
}

function noClicked() {
    // ئەگەر پێویست بوو دواتر هەڵسوکەوتی دوگمەی نەخێر بگۆڕین لێرەدا دەیکەین
    console.log("دوگمەی نەخێر کلیک کرا.");
}