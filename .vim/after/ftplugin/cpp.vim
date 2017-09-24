 setlocal path=.,/usr/include,/usr/local/opt/open-mpi/include,

 let g:clang_c_options = '-std=gnu11'
 let g:clang_cpp_options = '-std=c++11 -stdlib=libc++'
 let g:clang_use_library = 1
 let g:clang_auto = 0
